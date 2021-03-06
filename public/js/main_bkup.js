var app = {};
app.createConstants = function(){
  app.API = {
    STATAPI : '/apps/dmlocal/api/getJsonFromAPI/',
    AREAUNDERAPI : '/apps/dmlocal/api/getAreaUnder/',
    // GEOMSAPI : '/droughtmonitor/district/api/getGeomList/'
    GEOMSAPI : '/apps/dmlocal/api/getGeomList/'
  }
}

app.initializeVariables = function(){
  app.currentGraphs = 0;
  app.activeCropCalendar = {};
  app.geomListLoading = app.geomLoading = undefined
  app.activeRequests = [];
  app.tempCalc = {};
}

app.createHelpers = function(){
  //format ints with padding
  app.pad = function(num, size){
    s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

  app.genRandom = function(min, max, num){
    var arr = [];
    for (i=0;i<num;i++){
        arr.push(Math.round(Math.random()*(max-min))+min);
    }
    return arr;
  }

  app.getTimeString = function(interval,year,index){
    var suffix = app.pad(index,2);

    if (interval=='dd'){
      suffix = app.pad(parseInt((index-1)/3)+1,2)+app.pad((index%3==0)?3:(index%3),2);
    }else if (interval == '3m'){
      var su2 = app.pad((index+1>12)?1:(index+1),2);
      var su3 = app.pad((index+2>12)?(index-10):(index+2),2);
      suffix = suffix+su2+su3;
    }
    return year+suffix;
  }
  //function to add grapth
  app.addGraph = function(container, options){
    var template = '<div class="graphshell col-lg-6" style="padding:4px;padding-left:0;"><div class="panel panel-default card col-lg-12" style="padding:0;">'
                    +'<div class="panel-heading">'+options.chartTitle+'</div>'
                      +'<div id="chart'+app.currentGraphs+'" class="chart-content">'
                    +'</div>'
                  +'</div></div>'
    $(container).append(template);
    var chart = Highcharts.chart("chart"+app.currentGraphs, options);
    app.currentGraphs++;
    return chart;
  };
  //function to load graphs from resposne
  app.prepareGraph = function(data){
    var graphType = (data.graphType ? data.graphType : 'column')
    var y0 = y1 = '';
    if (data.yLabels){ y0 = data.yLabels[0], y1 = data.yLabels[1];}
    var options = {//chart: {type: chartType},
      chartTitle: data['title'],
      title: {text: null},
      legend: {enabled:false},
      xAxis: {categories: []},
      tooltip: {pointFormat: "Value: {point.y:.4f}"},
      yAxis: [{title: {text: y0}, gridLineColor:'rgba(0,0,0,0.5)', labels:{formatter:function(){return this.value;}}},
        {title: {text: y1},opposite:true, gridLineColor:'rgba(0,0,0,0.5)', labels:{formatter:function(){return this.value;}}}],
      series: [{type: graphType, color:data.color, name: '',data: []}],
    };
    options.series[0].name = data['name'];
    options.xAxis.categories = data['headers'];
    options.series[0].data = data['data'];

    return app.addGraph('.graph-section',options);
  }

  app.addSeries = function(chart, data){
    chart.legend.options.enabled = true;
    var series = {
      name: data['name'],
      data: data['data'],
      color: data.color,
      opacity:0.7,
      type: (data.graphType ? data.graphType : 'column'),
      yAxis: (data.whichSeries? data.whichSeries : 0)
    }
    chart.addSeries(series, true);
  }
  //helper function to aggregate data
  app._getAggregated = function(key, data){
    if (! app.tempCalc[key]) app.tempCalc[key]=0;
    return app.tempCalc[key] += data;
  }

  //function to populate l1
  app.populateL1 = function(e){
    // $("#selectl1").empty();
    app.geomListLoading = true
    $("button").attr('disabled','disabled');
    var l0 = $("#selectl0").val();
    $.ajax({
      url:app.API.GEOMSAPI,
      data:{country:l0},
      dataType: 'json',
      success:function(resp){
        var options = '';
        for (var i =0; i< resp.length; i++){
          options += '<option value="'+resp[i]+'">'+resp[i]+'</option>'
        }
        $("#selectl1").html(options);
        $("button").removeAttr('disabled');
        mapApp.updateGeometry($("#selectl0").val(), $("#selectl1").val());
        // app.geomListLoading = false
        app.updateSelectCrop();
        app.computeClicked();
      }
    });
  }
  // update crop DROPDOWNS
  app.updateSelectCrop = function(){
    var l0 = $("#selectl0").val();
    var l1 = $("#selectl1").val();
    var cal = cropCalendar[l0][l1];
    var cropList = Object.keys(cal);
    var html = '<option value = "All">All</option>';
    for (var i = 0; i<cropList.length; i++){
      html += '<option value = "'+cropList[i]+'">'+cropList[i]+'</option>';
    }
    $("#selectcrop").html(html);
    app.fetchCropCalendar();
  }

  //function to fetch crop Calendar
  app.fetchCropCalendar = function(){
    var place = $("#selectl0").val(), l1 = $("#selectl1").val(), crop = $("#selectcrop").val();
    $("#crop-calendar-crop-type").html($("#selectcrop").val());
    if (crop == 'All') app.activeCropCalendar = cropCalendar[place]['All'];
    else app.activeCropCalendar = cropCalendar[place][l1][crop]
    // populate crop dropdown

    if (crop != "All"){
      $(".crop-season").removeClass("hidden");
      $(".crop-all-year").addClass("hidden");
      $("#crop-calendar .sowing .start").html(getMonth(app.activeCropCalendar[0]));
      $("#crop-calendar .sowing .end").html(getMonth(app.activeCropCalendar[1]));
      // $("#crop-calendar .peak .start").html(getMonth(app.activeCropCalendar[2]));
      // $("#crop-calendar .peak .end").html(getMonth(app.activeCropCalendar[3]));
      // $("#crop-calendar .harvesting .start").html(getMonth(app.activeCropCalendar[4]));
      // $("#crop-calendar .harvesting .end").html(getMonth(app.activeCropCalendar[5]));
      // var sowing_period = app.activeCropCalendar[1]-app.activeCropCalendar[0]+1;
      var peak_period = app.activeCropCalendar[3]-app.activeCropCalendar[2]+1;
      // var harvesting_period = app.activeCropCalendar[5]-app.activeCropCalendar[4]+1;
      // var max = Math.max(sowing_period, peak_period, harvesting_period);
      $("#crop-calendar .sowing .bar-container .bar").css('width', "100%")
      // $("#crop-calendar .sowing .bar-container .bar").css('width', ((sowing_period/max)*100)+"%")
      // $("#crop-calendar .peak .bar-container .bar").css('width', ((peak_period/max)*100)+"%")
      // $("#crop-calendar .harvesting .bar-container .bar").css('width', ((harvesting_period/max)*100)+"%")
    }else {
      $(".crop-season").addClass("hidden");
      $(".crop-all-year").removeClass("hidden");
    }

    function getMonth(value){
      var months = ["JAN", "FEB", "MAR","APR", "MAY", "JUN", "JUL","AUG", "SEP", "OCT","NOV", "DEC"];
      return months[(value-1)%12];
    }

    return app.activeCropCalendar;
  }

  //making the graphs sortable
  app.makeGraphsSortable = function(){
    //making graphs sortable
    var panelList2 = $('.graph-section');
    panelList2.sortable({
      handle: '.panel-heading',
      helper: 'clone',
      update: function() {
        $('.graphshell', panelList2).each(function(index, elem) {
           var $listItem = $(elem),
             newIndex = $listItem.index();
           // Persist the new indices.
        });
      }
    });
  }

  // // make legend big on hover
  // app.handleLegendResponse = function(){
  //   $('.legend-text').on('mouseenter',function(e){
  //     $('.legend-text').css('font-size','15px');
  //   });
  //   $('.legend-text').on('mouseout',function(e){
  //     $('.legend-text').css('font-size','10px');
  //   });
  // }

  //MAKING DROPDOWNS RESPONSIVE
  app.makeDropdownsResponsive = function(){
    $("#selectl0").on("change", app.populateL1);

    $("#selectl1").on("change", function(e){
      mapApp.updateGeometry($("#selectl0").val(), $(this).val());
      app.updateSelectCrop();
    });
    $("#selectcrop").on("change", function(e){
      app.fetchCropCalendar();
    });
  }

  //process request with current options
  app.computeClicked = function(e){
    // console.log(app.activeRequests.length);
    for (var i =0; i<app.activeRequests.length; i++){app.activeRequests[i].abort();}
    app.activeRequests = []
    var calendar = app.fetchCropCalendar();

    var l0 = $("#selectl0").val()
    var l1 = $("#selectl1").val()
    // mapApp.updateGeometry(l0,l1);

    //get crop type
    var crop = $("#selectcrop").val()
    //get data interval
    var interval = $("#selectdataset").val();
    //get Year
    var year = $("#selectyear").val();

    $('.graph-section').empty();

    mapApp.getWMSLayer(interval, year, calendar);

    mapApp.updateSlider({
      interval:interval,
      year:year,
      startDate:calendar[0],
      endDate:calendar[calendar.length-1]
    });

    var selectedIndices = $("#selectindices").val();
    if (! selectedIndices) {
      $(".no-graph").removeClass('hidden');
      $(".graph-section").addClass('hidden');
      return;
    }

    $(".graph-section").removeClass('hidden');
    $(".no-graph").addClass('hidden');
    var addToDefaultOptions = function(options){
      var defaults = {
        url: app.API.STATAPI,
        country: l0,
        geometry: l1,
        year: year,
        crop: crop,
        interval: interval,
        calendar: calendar,
        metric: ['mean'],
        method: 'POST',
        graphType: [],
        color: ['rgba(19, 175, 8, 0.7)']
      };
      return Object.assign({}, defaults, options);
    }

    Object.keys(app.tempCalc).map(function(key){app.tempCalc[key] = 0;return key;});

    if (selectedIndices.includes("temp")) app.getGraphFromBldas(addToDefaultOptions({
      title: "Temperature (&deg;C)",
      variable: ['tempMin', 'tempMax'],
      mappingFun: [VALUESCALE['temp'], VALUESCALE['temp']],
      metric: ['min', 'max'],
      whichSeries: [0,0],
      names: ['Min Temperature', 'Max Temperature'],
      graphType: ['line', 'line'],
      color:['blue','red']
    }));
    // if (selectedIndices.includes("rain")) app.getGraphFromBldas(addToDefaultOptions({
    //   title: "Rainfall (mm/day)",
    //   variable: ['rain', 'rain'],
    //   metric: ['min', 'max'],
    //   names: ['Min Rainfall', 'Max Rainfall'],
    //   color:['orange', 'blue']
    // }));
    if (selectedIndices.includes("rain")) app.getGraphFromBldas(addToDefaultOptions({
      title: "Rainfall (mm/day)",
      variable: ['rain', 'rain','rain'],
      mappingFun : [,,VALUESCALE['rainfallAggregate']],
      metric: ['min', 'max','max'],
      whichSeries: [0,0,1],
      names: ['Min Rainfall', 'Max Rainfall', 'Season Aggregated Rainfall'],
      graphType: [,,'line'],
      yLabels:['Rainfall', 'Accumulated Rainfall'],
      color:['orange', 'blue', 'purple']
    }));
    if (selectedIndices.includes("NDVI")) app.getGraphFromBldas(addToDefaultOptions({
      title: "NDVI",
      variable: ['emodisNdvi'],
      names: ['NDVI'],
      color:['rgba(19,175,8,0.7)']
    }));
    // if (selectedIndices.includes("NDVI")) app.getGraphFromBldas(addToDefaultOptions({
    //   title: "NDVI (with anomaly)",
    //   variable: ['emodisNdvi', 'ndviAnomaly'],
    //   graphType: [,'line'],
    //   whichSeries: [0,1],
    //   mappingFun: [VALUESCALE['emodisNdvi'], VALUESCALE['ndviAnomaly']],
    //   yLabels: ['NDVI','NDVI anomaly'],
    //   names: ['NDVI', 'NDVI anomaly'],
    //   color: ['rgba(19, 175, 8, 0.7)','rgba(19, 8, 175, 0.7)']
    // }));
    if (selectedIndices.includes("ndviAnomaly")) app.getGraphFromBldas(addToDefaultOptions({
      title: "NDVI anomaly",
      variable: ['ndviAnomaly'],
      graphType: ['line'],
      mappingFun: [VALUESCALE['ndviAnomaly']],
      names: ['NDVI anomaly'],
      color: ['rgba(19, 175, 8, 0.7)']
    }));
    if (selectedIndices.includes("soilMoist")) app.getGraphFromBldas(addToDefaultOptions({
      title: "Soil Moisture (kg/m<sup>2</sup>)",
      variable: ['soilMoist'],
      names: ['Soil Moisture'],
      graphType: ['line'],
      color: ['chocolate']
    }));
    if (selectedIndices.includes("evap")) app.getGraphFromBldas(addToDefaultOptions({
      title: "Total Evapotranspiration (kg/m<sup>2</sup>)",
      variable: ['evap'],
      names: ['Total Evapotranspiration']
    }));
    // app.getGraphFromBldas(addToDefaultOptions({
    //   title: "SPI",
    //   variable: ['ch2Spi'],
    //   names: ['SPI']
    // }));
    if (selectedIndices.includes("spi-1To1")) app.getGraphFromBldas(addToDefaultOptions({
     url: app.API.AREAUNDERAPI,
     variable: ['ch2Spi'],
     metric: ['area_under'],
     title: 'Area Under SPI range (-1 and 1) (km<sup>2</sup>)',
     names: ['Area Under SPI range (-1 and 1)'],
     maxVal: 1,
     minVal: -1,
    }));
  }

  app.getGraphFromBldas = function(args){
    //building request parameters
    var rp = {};
    //set data interval
    var interval = rp['interval'] = args['interval'];
    //set Year
    rp['year'] = parseInt(args['year']);
    //set type
    rp['type'] = args['method'];
    //set country
    rp['country'] = args['country'];
    //set geometry
    rp['geom'] = args['geometry'];
    // set start month
    rp['month'] = args['calendar'][0];
    // set month buffer
    rp['range'] = args['calendar'][args['calendar'].length-1] - args['calendar'][0] +1;
    // set maxVal
    if (args['maxVal']!== undefined) rp['maxVal'] = args['maxVal'];
    // set minVal
    if (args['minVal']!== undefined) rp['minVal'] = args['minVal'];
    // console.log(args['calendar'][args['calendar'].length-1],args['calendar'][0], rp['range']);
    // if (args['calendar'][args['calendar'].length-1] > 12) rp['range'] = rp['range']+1;

    // url to make activeRequest
    var requestURL = args['url'];
    var graphType = args['graphType'];
    var metric = args['metric'];
    var mappingFun = args['mappingFun'];
    var title = args['title'];
    var yLabels = args['yLabels'];
    var names = args['names'];
    var whichSeries = args['whichSeries'];
    var color = args['color'];

    var numVariables = args['variable'].length;
    var currentVar = 0;
    var currentChart;
    getData(currentVar, rp);
    //get data
    function getData(currentVar){
      rp['variable'] = args['variable'][currentVar]
      graphType = args['graphType'][currentVar]

      var currentRequest = $.ajax({
        url: requestURL,
        data: {params:JSON.stringify(rp)},
        success: function(response){
          // console.log(response);
          if (response.success == 'success'){
            var curMetric = metric[currentVar];
            if (!curMetric) curMetric = 'mean';
            if (curMetric != 'area_under') curMetric = curMetric +"_data";
            var reqdata = response['time_series'][curMetric];
            var period_name = (interval == 'dd'? 'dekad':((interval == 'mm'?'monthly':'3 monthly')))
            var headers = reqdata.map(function(item, index){
              if  (interval == 'dd'){
                var dt = new Date(item[0]);
                if (dt.getDate()<=10){
                  return dt.toString('yy-MMM-D1')
                }else if (dt.getDate()<=20){
                  return dt.toString('yy-MMM-D2')
                }else{
                  return dt.toString('yy-MMM-D3')
                }
              }else if (interval == 'mm'){
                return (new Date(item[0])).toString('yy-MMM');
              }else {
                var dt = new Date(item[0]);
                var str = dt.toString('yy-');
                str += dt.toString('MMM')[0];
                dt.setDate(1);
                dt.setMonth(dt.getMonth()+1);
                str += dt.toString('MMM')[0];
                dt.setMonth(dt.getMonth()+1);
                str += dt.toString('MMM')[0];
                return str;
              }
            });
            var data = reqdata.map(function(item, index){return item [1]});
            var series = 0;
            if (whichSeries && whichSeries[currentVar]) series = whichSeries[currentVar];
            if (mappingFun && mappingFun[currentVar]) data = data.map(mappingFun[currentVar]);
            if (!currentChart) currentChart = app.prepareGraph({headers: headers, name:names[currentVar], data: data, graphType: graphType, color:color[currentVar], yLabels: yLabels, title:title+" <span class = periodicity >"+args['crop']+" | "+args['geometry']+" | "+period_name+"</span>"});
            else app.addSeries(currentChart, {headers: headers, data: data, name:names[currentVar], graphType: graphType, color:color[currentVar], whichSeries: series});
            currentVar++;
            if (currentVar < numVariables){
              getData(currentVar);
            }
          }else {
            console.log('failed!');
          }
        }
      });
      app.activeRequests.push(currentRequest);
    }
  };

}

app.initiUI = function(){
  $("#selectindices").select2({
    maximumSelectionLength: 2
  }).on('select2:unselecting', function() {
      $(this).data('unselecting', true);
    }).on('select2:opening', function(e) {
      if ($(this).data('unselecting')) {
        $(this).removeData('unselecting');
        e.preventDefault();
      }
    });
  app.map = L.map('map-container').setView([27, 84], 4);
  app.topMap = L.map('top-map-container', {zoomControl: false, attributionControl:false}).setView([27, 84], 4);
  // light theme basemap
  app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/ciiibvf1k0011alki4gp6if1s/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // satellite streets basemap
  // app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // app.baseMap2 = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  app.baseMap.addTo(app.map);
  // app.baseMap2.addTo(app.topMap);
  mapApp.setMap(app.map);
  mapApp.setTopMap(app.topMap);
  mapApp.addVariableSelector();
  mapApp.updateLegend();
  mapApp.addSlider({map:app.map});
  $('#nav-title-wrapper a').on('click', function(e){
    for (var i = 25;i<400; i=i+25)
      setTimeout(function(){mapApp.map.invalidateSize()}, i);
  });
  $(".drag-bar").on('mousedown', function(oe){
    var initialy = oe.clientY;
    var maincompHeight = $('.maincomp').height();
    var initialMapHeight = $('#map-container').height();
    var initialGraphHeight = $('.graph-section').height() || $('.no-graph').height();
    var offset = 50;
    var netpad = 21;
    $("body").on('mousemove mouseup', function handler(e){
      var movedy = e.clientY - initialy;
      // resize map
      var newMapHeight = initialMapHeight + movedy;
      newMapHeight = (newMapHeight < 0)? 0:newMapHeight;
      newMapHeight = (newMapHeight > (maincompHeight - offset))? (maincompHeight - offset):newMapHeight;
      mapApp.map.invalidateSize();
      // resize chart space
      var newGraphHeight = initialGraphHeight - movedy;
      newGraphHeight = (newGraphHeight < (offset-netpad))? (offset-netpad):newGraphHeight;
      newGraphHeight = (newGraphHeight > (maincompHeight-netpad))? (maincompHeight-netpad):newGraphHeight;
      $('#map-container').height(newMapHeight);
      $('#top-map-container').height(newMapHeight);
      $('.no-graph').height(newGraphHeight);
      $('.graph-section').height(newGraphHeight);
      // resize charts as well
      for (var i=0; i< app.currentGraphs; i++)
        $("#chart"+i).highcharts().setSize($("#chart"+i).width(),$("#chart"+i).height());
      // console.log(e.type)
      if (e.type == 'mouseup'){
        $("body").off('mousemove mouseup',handler);
      }
    });
  });
  app.populateL1();
}

app.addHandlers = function(){
  app.makeGraphsSortable();
  app.makeDropdownsResponsive();
  // app.handleLegendResponse();
}

jQuery(function($) {
  app.createConstants();
  app.initializeVariables();
  app.createHelpers();
  app.initiUI();
  //app.fetchCropCalendar();
  app.addHandlers();

  // app.computeClicked();
});
