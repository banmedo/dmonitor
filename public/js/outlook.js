
// Getting the csrf token
let csrftoken = Cookies.get('csrftoken');

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});

var app = {};

app.createConstants = function(){
  app.API = {
    TSAPI : 'http://tethys.icimod.org/apps/sldasdataforecast/ajax/getspatialaverage/',
    // TSAPI : '/apps/sldasdataforecast/ajax/getspatialaverage/',
    GEOMSAPI : '/apps/dmlocal/api/getGeomList/'
  }
  app.DEFAULTS = {
    COUN: 'Nepal',
    DIST: {
      'Nepal': 'l2Jumla',
      'Afghanistan': 'l2Ab_Band',
      'Afghanistan(Rangeland)': 'l2Ab_Band',
      'Bangladesh': 'l2Dhaka',
      'Pakistan':'l2Islamabad',
      'Pakistan(Rangeland)':'l2Islamabad'
    },
    PERIOD: 'mm',
    YEAR: new Date().getFullYear()+'',
    ENSEMBLE: 'mean'
  }
  app.COLORS = {
    MAXTEMP:'#f97070',
    MINTEMP:'#70a5f9',
    MINRAIN:'orange',
    MAXRAIN:'',
    AGGRAIN:'purple',
    NDVI:'rgba(19,175,8,0.7)',
    NDVIANOM:'rgba(19, 175, 8, 0.7)',
    SOILMOIST:'rgba(210, 105, 30, 0.7)',
    EVAP:'',
    SPI1:'',
    LTA:'black'
  }
}

app.parseParameters = function(){
  function getParam(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return decodeURI(results[1]) || 0;
    }
  }
  app.baseURL = document.location.href.split('?')[0];
  app.URLparams = {};
  app.URLparams['c'] = getParam('c');
  app.URLparams['d'] = getParam('d');
  // app.URLparams['sd'] = getParam('sd');
  // app.URLparams['ed'] = getParam('ed');
  app.URLparams['e'] = getParam('e');

  let flagChangeURL = false;
  let url = document.location.href;
  // redirect to jumla district if none is selected
  if (!app.URLparams['c']){
    let defaultCountry = app.DEFAULTS.COUN;
    if(document.location.href.includes('?')) {
      url = url+"&c="+defaultCountry;
    }else{
      url = url+"?c="+defaultCountry;
    }
    app.URLparams['c'] = defaultCountry;
    flagChangeURL = true;
  }
  if (!app.URLparams['d']){
    let ddist = app.DEFAULTS.DIST[app.URLparams['c']];
    if(url.includes('?')) {
      url = url+"&d="+ddist;
    }else{
      url = url+"?d="+ddist;
    }
    app.URLparams['d'] = ddist;
    flagChangeURL = true;
  }
  if (!app.URLparams['e']){
    let defaultEnsemble = app.DEFAULTS.ENSEMBLE;
    if(url.includes('?')) {
      url = url+"&e="+defaultEnsemble;
    }else{
      url = url+"?e="+defaultEnsemble;
    }
    app.URLparams['e'] = defaultEnsemble;
    flagChangeURL = true;
  }
  $('#selectl0').text(app.URLparams['c']);
  if (flagChangeURL) window.history.replaceState({}, 'Nepal', url);

  // $("#selecten").val(app.URLparams['e']);
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
  }
  app.addGraphOnDiv = function(divID, ref, options){
    let titleHTML = '<div class=panel-heading style="height:20px;padding:0px 10px;background:rgba(255,255,255,0);color:black" title="'+TOOLTIPS[ref]+'">'+options.chartTitle+'</div>';
    let chartHTML = '<div id='+divID+'child style="height:calc(100% - 20px);width:100%"></div>';
    $("#"+divID).html(titleHTML+chartHTML);
    // $("#"+divID+" .panel-heading").tooltip({placement:'bottom'});
    var chart = Highcharts.chart(divID+'child', options);
    app.currentGraphs++;
    return chart;
  }
  //function to load graphs from resposne
  app.prepareGraph = function(data){
    // console.log(data);
    var graphType = (data.graphType ? data.graphType : 'column')
    var y0 = y1 = '';
    if (data.yLabels){ y0 = data.yLabels[0], y1 = data.yLabels[1];}
    var options = {//chart: {type: chartType},
      chartTitle: data['title'],
      chart: {
        backgroundColor: 'rgba(255,255,255,0)',
        style: { "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif", "fontSize": "10px" },
        plotBackgroundColor: null,
        plotBorderWidth: null,
        plotShadow: false
      },
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
    // return app.addGraph('.graph-section',options);
    return app.addGraphOnDiv(data.div,data.ref,options);
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
    if (data.graphType == 'point'){
      series.type = 'line';
      series.lineWidth = 0;
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
    let l0 = app.URLparams['c'];
    // $("#selectl0").val(l0);
    $.ajax({
      url:app.API.GEOMSAPI,
      data:{country:l0},
      dataType: 'json',
      success:function(resp){
        resp = resp.sort();
        var l1names = [];
        var l2names = [];
        resp.forEach(function(val){
          if(val.substr(0,2) == 'l1') l1names.push(val.substr(2));
          else if (val.substr(0,2) == 'l2') l2names.push(val.substr(2));
        });
        // resp = resp.map(function(val){return val.substr(2)});
        var options = '';
        for (var i =0; i< l1names.length; i++){
          options += '<option value="'+l1names[i]+'">'+l1names[i]+'</option>'
        }
        $("#selectl1").html(options).val(l1names[0]);
        var options = '';
        for (var i =0; i< l2names.length; i++){
          options += '<option value="'+l2names[i]+'">'+l2names[i]+'</option>'
        }
        $("#selectl2").html(options).val(l2names[0]);
        let geom = app.URLparams.d;
        let lev = geom.substr(0,2);
        let name = geom.substr(2);
        $("#bradio"+lev).attr('checked',true);
        $("#select"+lev).val(name);

        // console.log(geom, lev, name)
        //if (!resp.includes(l2)) l2 = app.DEFAULTS.DIST[l0];
        //$("#selectl2").val(l2);
        $("button").removeAttr('disabled');
        mapApp.updateGeometry(l0,geom);
        // app.geomListLoading = false
        // app.updateSelectCrop();
        app.computeClicked();
      }
    });
  }

  // update crop DROPDOWNS
  app.updateSelectCrop = function(){
    // var l0 = $("#selectl0").val();
    var l0 = app.URLparams['c'];
    var l1 = $("#selectl2").val();
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
    var today = new Date();
    var month = today.getMonth(); // prev Month as our month index starts from 1 so month +1 -1
    var year  = today.getFullYear();
    var endMonth = month;
    if (month < 10) endMonth = month+12; // jump year for months after october
    app.activeCropCalendar = [10, endMonth]; //get 12 months data
    if (app.URLparams['p'] == '3m') app.activeCropCalendar = [8, endMonth-2];
    // app.activeCropCalendar = [10, endMonth];
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

  //MAKING DROPDOWNS RESPONSIVE
  app.makeDropdownsResponsive = function(){
    // $("#selectl0").on("change", app.populateL1);
    $("input[name=level]").on("change", function(e){
      var source = e.target.id;
      var level = source.substr(-2);
      $("#selectl1").prop('disabled',true);
      $("#selectl2").prop('disabled',true);
      $("#select"+level).prop('disabled', false);

      var geom = $("#select"+level).val();
      if (level == 'l0') mapApp.updateGeometry(app.URLparams['c'], level+$("#select"+level).text().trim());
      else mapApp.updateGeometry(app.URLparams['c'], level+$("#select"+level).val());
      app.URLparams.d = level+$("#select"+level).val();
    });

    $("#selectl1").on("change", function(e){
      // mapApp.updateGeometry($("#selectl0").val(), $(this).val());
      mapApp.updateGeometry(app.URLparams['c'], 'l1'+$(this).val());
      app.URLparams.d = 'l1'+$(this).val();
      // app.updateSelectCrop();
    });
    $("#selectl2").on("change", function(e){
      // mapApp.updateGeometry($("#selectl0").val(), $(this).val());
      mapApp.updateGeometry(app.URLparams['c'], 'l2'+$(this).val());
      app.URLparams.d = 'l2'+$(this).val();
      // app.updateSelectCrop();
    });

    $("#selecten").on('change',mapApp.mapVariableChanged);

  }

  //process request with current options
  app.computeClicked = function(e){
    app.updateURL();

    var l0 = app.URLparams.c;
    var gid = $("input[type=radio][name=level]:checked").attr('id');
    var lev = gid.substr(gid.length-2)
    var geom = lev+$("#select"+lev).val();
    var ensemble = $("#selecten").val()
    var plotType = (ensemble == "mean"?"boxplot":"line")
    ensemble = "_"+ensemble+".ncml";

    let selectedIndices = [
      "Tair_f_tavg",
      "Rainf_f_tavg",
      "SoilMoist_inst",
      "Evap_tavg"
    ];
    let divIDs = {};
    if (! selectedIndices) {
      $(".no-graph").removeClass('hidden');
      $(".graph-section").addClass('hidden');
      return;
    } else {
      for (var i=0;i<selectedIndices.length;i++){
        divIDs[selectedIndices[i]] = "chart"+i;
      }
    }

    $(".graph-section").removeClass('hidden');
    $(".no-graph").addClass('hidden');
    var addToDefaultOptions = function(options){
      var defaults = {
        url: app.API.TSAPI,
        country: l0,
        geometry: app.URLparams.c+geom,
        animinterval: 'monthly',
        ensemble: ensemble,
        metric: ['mean'],
        method: 'POST',
        graphType: plotType,
        color: ['']
      };
      return Object.assign({}, defaults, options);
    }
    app.getOutlookGraph(addToDefaultOptions({
      variable:"Tair_f_tavg",
      div: divIDs.Tair_f_tavg,
      title:"Air Temperature"
    }));
    app.getOutlookGraph(addToDefaultOptions({
      variable:"Rainf_f_tavg",
      div: divIDs.Rainf_f_tavg,
      title:"Rainfall flux"
    }));
    app.getOutlookGraph(addToDefaultOptions({
      variable:"SoilMoist_inst",
      div: divIDs.SoilMoist_inst,
      title:"Soil moisture content"
    }));
    app.getOutlookGraph(addToDefaultOptions({
      variable:"Evap_tavg",
      div: divIDs.Evap_tavg,
      title:"Total evapotranspiration"
    }));


    // if (selectedIndices.includes("tempExtreme")) app.getGraphFromBldas(addToDefaultOptions({
    //   div: divIDs.tempExtreme,
    //   ref:"tempExtreme",
    //   title: "Temperature (&deg;C)",
    //   variable: ['tempMin', 'tempMax'],
    //   mappingFun: [VALUESCALE['temp'], VALUESCALE['temp']],
    //   metric: ['min', 'max'],
    //   whichSeries: [0,0],
    //   names: ['Min Temperature', 'Max Temperature'],
    //   graphType: ['line', 'line'],
    //   color:[app.COLORS.MINTEMP,app.COLORS.MAXTEMP]
    // }));
  }

  app.getOutlookGraph = function(args){
    var reqparams = {
      // coords:[79.630498,28.155395],
      variable:args.variable,
      anominterval:"monthly",
      ensemble:args.ensemble,
      distnum:args.geometry,
      shapefile:"true"
    };
    // var reqparams  = {coords:[79.630498,28.155395],variable:"Tair_f_tavg",anominterval:"monthly",ensemble:"_mean.ncml"};
    // args.graphType = 'singleline';
    $.ajax({
      url: app.API.TSAPI,
      data: JSON.stringify(reqparams),
      dataType: 'json',
      contentType: "application/json",
      method: 'POST',
      success: function (result) {
        // console.log(result);
        var headers = result.values.map(function(element){
          return (new Date(element[0])).toUTCString().substring(8,16);
        });
        var data = result.values.map(function(element){return element[1]});
        // var data = [];
        // if (args.graphType == 'boxplot'){
        //   var reqdata = result[args.graphType];
        //   var headers = reqdata.map(function(item, index){
        //     return (new Date(item[0])).toUTCString().substring(8,16);
        //   });
        //   data = reqdata.map(function(item, index){
        //       return item.splice(1);
        //   });
        // }else{
        //   var reqdata = result['multiline']['mean'];
        //   var headers = reqdata.map(function(item, index){
        //     return (new Date(item[0])).toUTCString().substring(8,16);
        //   });
        //   data = reqdata.map(function(item, index){
        //       return item[1];
        //   });
        // }

        if (args.graphType == 'multiline') args.graphType = 'line';

        app.prepareGraph({
          div:args.div,
          headers: headers,
          name:args.name,
          data: data,
          graphType:'line',//args.graphType,
          title:args.title
        });
      }
    });
  }

  // update the URL of application based on options
  app.updateURL = function(){
    let l0 = app.URLparams['c'];

    var geom = app.URLparams['d'];
    // let period = $("#selectdataset").val();
    let selectedEn = $("#selecten").val();
    // let indices = $("#selectindices").val().join(',');
    app.URLparams = {
      'c':l0,
      'd':geom,
      'e':selectedEn,
    }
    let url = app.baseURL+"?c="+l0+
            "&d="+geom+
            "&e="+selectedEn;
    if (document.location.href!=url) window.history.pushState({}, 'Nepal', url);
    else window.history.replaceState({}, 'Nepal', url);
  }

}

app.initiUI = function(){
  $('.bound-dropdown').empty();
  for (var i=0; i<INDICES.length;i++){
    $('.bound-dropdown').append('<option value="'+INDICES[i][0]+'">'+INDICES[i][1]+'</option>');
  }

  var en = app.URLparams['e'];

  $('#selecten').val(en)

  // app.map = L.map('map-container').setView([27, 84], 4);
  app.topMap = L.map('top-map-container', {zoomControl: false, attributionControl:false}).setView([27, 84], 4);
  // light theme basemap
  mapApp.setTopMap(app.topMap);

  app.map = L.map('map-container',{
      minZoom: 2,
      boxZoom: true,
      // maxBounds: L.latLngBounds(L.latLng(-100.0, -270.0), L.latLng(100.0, 270.0)),
      timeDimension: true,
      timeDimensionControl: true,
      timeDimensionControlOptions: {
          position: "bottomleft",
          autoPlay: true,
          loopButton: true,
          backwardButton: true,
          forwardButton: true,
          timeSliderDragUpdate: true,
          minSpeed: 1,
          maxSpeed: 6,
          speedStep: 1,
          timeInterval: "2014-09-30/2014-10-30",
          period: "PT1H"
      },
  }).on('load',function(){
      $('.leaflet-control-attribution').remove();
  }).setView([27.25, 84],4);
  mapApp.setMap(app.map);


  app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/ciiibvf1k0011alki4gp6if1s/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // satellite streets basemap
  // app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // app.baseMap2 = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  app.baseMap.addTo(app.map);
  // district wms layer
  let layername = 'geonode:nepal_administrative_boundaries_level_3';
  app.districtWMS = L.tileLayer.wms("https://geonode.wfp.org/geoserver/wms/?",{
    layers:layername,
    transparent:true,
    format:'image/png',
  });
  app.districtWMS.addTo(app.map);

  // app.baseMap2.addTo(app.topMap);
  mapApp.addVariableSelector();
  mapApp.updateLegend();

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

  // mapApp.mapVariableChanged($("#selmapvar")[0]);
}

app.addHandlers = function(){
  app.makeGraphsSortable();
  app.makeDropdownsResponsive();
  // app.handleLegendResponse();
}

jQuery(function($) {
  app.createConstants();
  app.parseParameters();
  app.initializeVariables();
  app.createHelpers();
  app.initiUI();
  app.addHandlers();
  $(".app-title").append("- "+app.URLparams.c);
  $("#curlink").prop('href',$("#curlink").prop('href')+"/?c="+app.URLparams.c);
  $("#sealink").prop('href',$("#sealink").prop('href')+"/?c="+app.URLparams.c);
  $("#outlink").prop('href',$("#outlink").prop('href')+"/?c="+app.URLparams.c);
});
