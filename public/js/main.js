var app = {};

app.createConstants = function(){
  app.API = {
    STATAPI : '/apps/dmlocal/api/getJsonFromAPI/',
    LTAAPI : '/apps/dmlocal/api/getLTAStats/',
    AREAUNDERAPI : '/apps/dmlocal/api/getAreaUnder/',
    // GEOMSAPI : '/droughtmonitor/district/api/getGeomList/'
    GEOMSAPI : '/apps/dmlocal/api/getGeomList/',
    SEASONAGG : '/apps/dmlocal/api/seasonagg',
    PNORMAL : '/apps/dmlocal/api/percentageOfNormal'
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
    YEAR:'2018',
    START: '01',
    END: '12',
    INDICES: 'seasonAgg,rain,soilMoist,pNormal'
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
  app.URLparams['sd'] = getParam('sd');
  app.URLparams['ed'] = getParam('ed');
  app.URLparams['p'] = getParam('p');
  app.URLparams['y'] = getParam('y');
  app.URLparams['i'] = getParam('i');
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
    let ddist =  app.DEFAULTS.DIST[app.URLparams['c']];
    if(url.includes('?')) {
      url = url+"&d="+ddist;
    }else{
      url = url+"?d="+ddist;
    }
    app.URLparams['d'] = ddist;
    flagChangeURL = true;
  }
  if (!app.URLparams['p']){
    let defaultPeriod = app.DEFAULTS.PERIOD;
    if(url.includes('?')) {
      url = url+"&p="+defaultPeriod;
    }else{
      url = url+"?p="+defaultPeriod;
    }
    app.URLparams['p'] = defaultPeriod;
    flagChangeURL = true;
  }
  if (!app.URLparams['y']){
    let defaultYear = app.DEFAULTS.YEAR;
    if(url.includes('?')) {
      url = url+"&y="+defaultYear;
    }else{
      url = url+"?y="+defaultYear;
    }
    app.URLparams['y'] = defaultYear;
    flagChangeURL = true;
  }
  if (!app.URLparams['sd']){
    let defaultStart = app.DEFAULTS.START;
    if(url.includes('?')) {
      url = url+"&sd="+defaultStart;
    }else{
      url = url+"?sd="+defaultStart;
    }
    app.URLparams['sd'] = defaultStart;
    flagChangeURL = true;
  }
  if (!app.URLparams['ed']){
    let defaultStart = app.DEFAULTS.END;
    if(url.includes('?')) {
      url = url+"&ed="+defaultStart;
    }else{
      url = url+"?ed="+defaultStart;
    }
    app.URLparams['ed'] = defaultStart;
    flagChangeURL = true;
  }
  if (!app.URLparams['i']){
    let defaultIndices = app.DEFAULTS.INDICES;
    if(url.includes('?')) {
      url = url+"&i="+defaultIndices;
    }else{
      url = url+"?i="+defaultIndices;
    }
    app.URLparams['i'] = defaultIndices;
    flagChangeURL = true;
  }else{
    var indices = app.URLparams['i'].split(',');
    $('#selectindex1').val(indices[0])
    $('#selectindex2').val(indices[1])
    $('#selectindex3').val(indices[2])
    $('#selectindex4').val(indices[3])
  }
  $('#selectl0').text(app.URLparams['c']);
  if (flagChangeURL) window.history.replaceState({}, 'Nepal', url);

  // activate static options based on URL
  // for periodicity option
  $("input[name=periodicity][value="+app.URLparams['p']+"]").prop("checked", true);
  // for dropdown
  $("#selectyear").val(app.URLparams['y']);
  $("#selectyear").on('change', function(e){app.onYearChange(e);});
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

  app.parseIntArr = function (number){return parseInt(number);};


  app.genRandom = function(min, max, num){
    var arr = [];
    for (i=0;i<num;i++){
        arr.push(Math.round(Math.random()*(max-min))+min);
    }
    return arr;
  }

  app.getDateString = function(mind,year){
    mind = parseInt(mind);
    year = parseInt(year);
    if (mind>12){
      return [mind-12,year+1].join("/");
    }
    return [mind,year].join("/");
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
  app.addGraphOnDiv = function(divID, ref, options){
    let titleHTML = '<div class=panel-heading style="height:20px;padding:0px 10px;background:rgba(255,255,255,0);color:black" title="'+TOOLTIPS[ref]+'" >'+options.chartTitle+'</div>';
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
      title: {text: null},
      chart: {
        backgroundColor: 'rgba(255,255,255,0)',
        style: { "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif", "fontSize": "10px" },
        plotBackgroundColor: null,
        plotBorderWidth: null,
        plotShadow: false
      },
      credits:{enabled:false},
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
        $("#selectl1").html(options);
        var options = '';
        for (var i =0; i< l2names.length; i++){
          options += '<option value="'+l2names[i]+'">'+l2names[i]+'</option>'
        }
        $("#selectl2").html(options);
        let geom = app.URLparams.d;
        let lev = geom.substr(0,2);
        let name = geom.substr(2);
        $("#bradio"+lev).attr('checked',true);
        $("#select"+lev).val(name);
        $("button").removeAttr('disabled');
        mapApp.updateGeometry(l0, geom);
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
    // var place = app.URLparams['c'], l1 = $("#selectl1").val(), crop = $("#selectcrop").val();
    // $("#crop-calendar-crop-type").html($("#selectcrop").val());
    // if (crop == 'All') app.activeCropCalendar = cropCalendar[place]['All'];
    // else app.activeCropCalendar = cropCalendar[place][l1][crop]
    // // populate crop dropdown
    //
    // if (crop != "All"){
    //   $(".crop-season").removeClass("hidden");
    //   $(".crop-all-year").addClass("hidden");
    //   $("#crop-calendar .sowing .start").html(getMonth(app.activeCropCalendar[0]));
    //   $("#crop-calendar .sowing .end").html(getMonth(app.activeCropCalendar[1]));
    //   // $("#crop-calendar .peak .start").html(getMonth(app.activeCropCalendar[2]));
    //   // $("#crop-calendar .peak .end").html(getMonth(app.activeCropCalendar[3]));
    //   // $("#crop-calendar .harvesting .start").html(getMonth(app.activeCropCalendar[4]));
    //   // $("#crop-calendar .harvesting .end").html(getMonth(app.activeCropCalendar[5]));
    //   // var sowing_period = app.activeCropCalendar[1]-app.activeCropCalendar[0]+1;
    //   var peak_period = app.activeCropCalendar[3]-app.activeCropCalendar[2]+1;
    //   // var harvesting_period = app.activeCropCalendar[5]-app.activeCropCalendar[4]+1;
    //   // var max = Math.max(sowing_period, peak_period, harvesting_period);
    //   $("#crop-calendar .sowing .bar-container .bar").css('width', "100%")
    //   // $("#crop-calendar .sowing .bar-container .bar").css('width', ((sowing_period/max)*100)+"%")
    //   // $("#crop-calendar .peak .bar-container .bar").css('width', ((peak_period/max)*100)+"%")
    //   // $("#crop-calendar .harvesting .bar-container .bar").css('width', ((harvesting_period/max)*100)+"%")
    // }else {
    //   $(".crop-season").addClass("hidden");
    //   $(".crop-all-year").removeClass("hidden");
    // }
    //
    // function getMonth(value){
    //   var months = ["JAN", "FEB", "MAR","APR", "MAY", "JUN", "JUL","AUG", "SEP", "OCT","NOV", "DEC"];
    //   return months[(value-1)%12];
    // }
    let sd = $("#startDate").val().split("/").map(app.parseIntArr);
    let ed = $("#endDate").val().split("/").map(app.parseIntArr);
    let year = parseInt($("#selectyear").val());

    if (ed[1]>year) ed[0]+=12;
    // if (app.URLparams['p'] == '3m') return [sd[0]-2, ed[0]-2];
    return [sd[0], ed[0]];
    // return [1,12];
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
      if (level == 'l0'){
        mapApp.updateGeometry(app.URLparams['c'], level+$("#select"+level).text().trim());
        app.URLparams.d = level+$("#select"+level).text();
      }else {
        mapApp.updateGeometry(app.URLparams['c'], level+$("#select"+level).val());
        app.URLparams.d = level+$("#select"+level).val();
      }
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
    $("#selectcrop").on("change", function(e){
      app.fetchCropCalendar();
    });
  }

  // handle year change
  app.onYearChange = function(e){
    let year = $("#selectyear").val();
    $("#startDate").MonthPicker({ Button: false,
      MinMonth: new Date(year,0),
      MaxMonth: new Date(year,11)<new Date().addMonths(-2)?new Date(year,11):new Date().addMonths(-2),
      OnAfterChooseMonth: function( e ){app.onStartChanged(e);}});
    // $("#endDate").MonthPicker({ Button: false,
    //   MinMonth: new Date(year,0),
    //   MaxMonth: new Date(parseInt(year)+1,11),
    //   OnAfterChooseMonth: function( e ){app.onEndChanged(e);}});
    $("#startDate").val("01/"+year);
    $("#endDate").val("12/"+year);
    app.onStartChanged();
  }

  app.onStartChanged = function(e){
    let sd = $('#startDate').val();
    let ed = $('#endDate').val();
    sd = sd.split("/").map(app.parseIntArr);
    ed = ed.split("/").map(app.parseIntArr);
    let nsd = new Date(sd[1],sd[0]-1);
    let ned = new Date(ed[1],ed[0]-1) < new Date().addMonths(-1) ? new Date(ed[1],ed[0]-1):new Date().addMonths(-1);
    let limitEndMin = new Date(sd[1],sd[0]-1).addMonths(1);
    let limitEndMax = new Date(sd[1],sd[0]-1).addMonths(11);
    let endBuffer = -1;
    if ($("input[name=periodicity]:checked").val() == '3m') endBuffer = -3;
    limitEndMax = limitEndMax < new Date().addMonths(endBuffer) ? limitEndMax:new Date().addMonths(endBuffer);
    if (((ned.getYear()-nsd.getYear())*12+(ned.getMonth()-nsd.getMonth()))>11)
      ned = nsd.addMonths(11)
    $("#endDate").val([ned.getMonth()+1,ned.getFullYear()].join("/"));
    $("#endDate").MonthPicker({
      MinMonth:limitEndMin,
      MaxMonth:limitEndMax});
  }

  // handle date range change
  app.onRangeChanged = function(e){
    let sd = $('#startDate').val();
    let ed = $('#endDate').val();
    let year = parseInt($('#selectyear').val());
    sd = sd.split("/").map(app.parseIntArr);
    ed = ed.split("/").map(app.parseIntArr);
    // if end year is less than start year
    let nsd = new Date(sd[1],sd[0]-1);
    let ned = new Date(ed[1],ed[0]-1);
    let maxDate = new Date(year+1,11);

    let dateDiff = ned-nsd;
    // console.log((ned.getYear()-nsd.getYear())*12+(ned.getMonth()-nsd.getMonth()));
    if (dateDiff <= 0){
      if (sd[0] == 12 && sd[1] == year+1){
        nsd.setMonth(nsd.getMonth()-1);
        $("#startDate").val([nsd.getMonth()+1,nsd.getFullYear()].join("/"));
      }else {
        ned.setMonth(ned.getMonth()+1);
        $("#endDate").val([ned.getMonth()+1,ned.getFullYear()].join("/"));
      }
    }
  }

  //process request with current options
  app.computeClicked = function(e){
    app.updateURL();
    // console.log(app.activeRequests.length);
    for (var i =0; i<app.activeRequests.length; i++){app.activeRequests[i].abort();}
    app.activeRequests = []
    var calendar = app.fetchCropCalendar();

    var l0 = app.URLparams.c;
    var gid = $("input[type=radio][name=level]:checked").attr('id');
    var lev = gid.substr(gid.length-2)
    var geom = lev+$("#select"+lev).val();
    // mapApp.updateGeometry(l0,l1);

    //get crop type
    // var crop = $("#selectcrop").val();
    //get data interval
    // var interval = $("#selectdataset").val();
    var interval = app.URLparams.p;
    //get Year
    var year = app.URLparams.y;
    $('.graph-section').empty();

    mapApp.getWMSLayer(interval, year, calendar);

    mapApp.updateSlider({
      interval:interval,
      year:year,
      startDate:calendar[0],
      endDate:calendar[calendar.length-1]
    });

    // let selectedIndices = $("#selectindices").val();
    let selectedIndices = [
      $("#selectindex1").val(),
      $("#selectindex2").val(),
      $("#selectindex3").val(),
      $("#selectindex4").val(),
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
        url: app.API.STATAPI,
        country: l0,
        geometry: geom,
        year: year,
        interval: interval,
        calendar: calendar,
        metric: ['mean'],
        method: 'POST',
        graphType: [],
        color: ['']
      };
      return Object.assign({}, defaults, options);
    }


    Object.keys(app.tempCalc).map(function(key){app.tempCalc[key] = 0;return key;});

    // if (selectedIndices.includes("tempExtreme")) app.getGraphFromBldas(addToDefaultOptions({
    //   div: divIDs.tempExtreme,
    //   ref:"tempExtreme",
    //   title: "Temperature (&deg;C)",
    //   variable: ['tempMin', 'tempMax','LTA_temp'],
    //   mappingFun: [VALUESCALE['temp'], VALUESCALE['temp'], VALUESCALE['temp']],
    //   metric: ['min', 'max', 'mean'],
    //   whichSeries: [0,0,0],
    //   names: ['Min Temperature', 'Max Temperature', 'Long Term Average'],
    //   graphType: ['line', 'line', 'point'],
    //   color:[app.COLORS.MINTEMP,app.COLORS.MAXTEMP, app.COLORS.LTA]
    // }));
    if (selectedIndices.includes("tempExtreme")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.tempExtreme,
      ref:"tempExtreme",
      title: "Temperature (&deg;C)",
      variable: ['tempMin', 'tempMax'],
      mappingFun: [VALUESCALE['temp'], VALUESCALE['temp']],
      metric: ['min', 'max'],
      whichSeries: [0,0],
      names: ['Min Temperature', 'Max Temperature'],
      graphType: ['line', 'line'],
      color:[app.COLORS.MINTEMP,app.COLORS.MAXTEMP]
    }));
    if (selectedIndices.includes("tempMean")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.tempMean,
      ref:"tempMean",
      title: "Temperature (&deg;C)",
      variable: ['temp', 'LTA_temp'],
      mappingFun: [VALUESCALE['temp'], VALUESCALE['temp']],
      metric: ['mean', 'mean'],
      whichSeries: [0,0],
      names: ['Mean Temperature', 'Long Term Average'],
      graphType: ['line', 'point'],
      color:[app.COLORS.MINTEMP,app.COLORS.LTA],
    }));
    // if (selectedIndices.includes("rain")) app.getGraphFromBldas(addToDefaultOptions({
    //   title: "Rainfall (mm/day)",
    //   variable: ['rain', 'rain'],
    //   metric: ['min', 'max'],
    //   names: ['Min Rainfall', 'Max Rainfall'],
    //   color:['orange', 'blue']
    // }));
    if (selectedIndices.includes("rain")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.rain,
      ref:"rain",
      title: "Rainfall (mm/day)",
      variable: ['rain','rain', 'LTA_rain'],
      mappingFun : [,VALUESCALE['rainfallAggregate'],],
      metric: ['mean','mean','mean'],
      whichSeries: [0,1,0],
      names: ['Mean Rainfall', 'Aggregated Rainfall','Long Term Average'],
      graphType: [,'line','point'],
      yLabels:['Rainfall', 'Accumulated Rainfall'],
      color:[app.COLORS.MAXRAIN, app.COLORS.AGGRAIN, app.COLORS.LTA]
    }));
    if (selectedIndices.includes("NDVI")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.NDVI,
      ref:"NDVI",
      title: "NDVI",
      variable: ['emodisNdvi'],
      graphType: ['line'],
      mappingFun: [VALUESCALE['emodisNdvi']],
      names: ['NDVI'],
      color:[app.COLORS.NDVI]
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
      div: divIDs.ndviAnomaly,
      ref:"ndviAnomaly",
      title: "NDVI anomaly",
      variable: ['ndviAnomaly'],
      graphType: ['line'],
      mappingFun: [VALUESCALE['ndviAnomaly']],
      names: ['NDVI anomaly'],
      color: [app.COLORS.NDVIANOM]
    }));
    if (selectedIndices.includes("soilMoist")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.soilMoist,
      ref:"soilMoist",
      title: "Soil Moisture (kg/m<sup>2</sup>)",
      variable: ['soilMoist', 'LTA_soilMoist'],
      names: ['Soil Moisture', 'Long Term Average'],
      graphType: ['line','point'],
      color: [app.COLORS.SOILMOIST, app.COLORS.LTA]
    }));
    if (selectedIndices.includes("evap")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.evap,
      ref:"evap",
      title: "Total Evapotranspiration (mm/day)",
      variable: ['evap','LTA_evap'],
      names: ['Total Evapotranspiration', 'Long Term Average'],
      graphType: [,'point'],
      color: [app.COLORS.EVAP,app.COLORS.LTA]
    }));
    if (selectedIndices.includes("ch2Spi")) app.getGraphFromBldas(addToDefaultOptions({
      div: divIDs.ch2Spi,
      ref:"ch2Spi",
      title: "SPI",
      variable: ['ch2Spi'],
      names: ['SPI'],
      color: [app.COLORS.EVAP]
    }));
    // app.getGraphFromBldas(addToDefaultOptions({
    //   title: "SPI",
    //   variable: ['ch2Spi'],
    //   names: ['SPI']
    // }));
    // if (selectedIndices.includes("spi-1To1")) app.getGraphFromBldas(addToDefaultOptions({
    //   div: divIDs["spi-1To1"],
    //   url: app.API.AREAUNDERAPI,
    //   variable: ['ch2Spi'],
    //   metric: ['area_under'],
    //   title: 'Area Under SPI range (-1 and 1) (km<sup>2</sup>)',
    //   names: ['Area Under SPI range (-1 and 1)'],
    //   maxVal: 1,
    //   minVal: -1,
    //   color: [app.COLORS.SPI1]
    // }));

    if (selectedIndices.includes("seasonAgg")) app.getSeasonalAggregatedRatio(addToDefaultOptions({
      div: divIDs.seasonAgg,
      title: "Seasonally Aggregated Values",
      ref:"seasonAgg"
    }));

    if (selectedIndices.includes("pNormal")) app.getPercentageOfNormal(addToDefaultOptions({
      div: divIDs.pNormal,
      title: "Percentage Of Normals",
      ref:"pNormal"
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
    let requestURL = args['url'];
    let graphType = args['graphType'];
    let metric = args['metric'];
    let mappingFun = args['mappingFun'];
    let title = args['title'];
    let yLabels = args['yLabels'];
    let names = args['names'];
    let whichSeries = args['whichSeries'];
    let color = args['color'];
    let div = args['div'];
    let ref = args['ref'];

    let numVariables = args['variable'].length;
    let currentVar = 0;
    let currentChart;
    getData(currentVar, rp);
    //get data
    function getData(currentVar){
      rp['variable'] = args['variable'][currentVar];
      graphType = args['graphType'][currentVar];
      let parts = rp['variable'].split('_');
      let tempURL = false;
      if (parts[0] == 'LTA'){
        tempURL = app.API.LTAAPI;
        rp['variable'] = parts[1];
      }

      var currentRequest = $.ajax({
        url: tempURL || requestURL,
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
                  return dt.toString('yyyy-MMM-D1')
                }else if (dt.getDate()<=20){
                  return dt.toString('yyyy-MMM-D2')
                }else{
                  return dt.toString('yyyy-MMM-D3')
                }
              }else if (interval == 'mm'){
                return (new Date(item[0])).toString('yyyy-MMM');
              }else {
                var dt = new Date(item[0]);
                var str = dt.toString('yyyy-');
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
            if (!currentChart) currentChart = app.prepareGraph({
              div:div,
              headers: headers,
              name:names[currentVar],
              data: data,
              graphType: graphType,
              color:color[currentVar],
              yLabels: yLabels,
              ref:ref,
              title:title});//+" <span class = periodicity >"+args['geometry']+" | "+period_name+"</span>"});
            else app.addSeries(currentChart, {
              headers: headers,
              data: data,
              name:names[currentVar],
              graphType: graphType,
              color:color[currentVar],
              whichSeries: series});
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

  app.getSeasonalAggregatedRatio = function(args){
    //building request parameters
    var rp = {};
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
    if (args['lbp']!== undefined) rp['lbp'] = args['lbp'];
    // set minVal
    if (args['hbp']!== undefined) rp['hbp'] = args['hbp'];
    // console.log(args['calendar'][args['calendar'].length-1],args['calendar'][0], rp['range']);
    // if (args['calendar'][args['calendar'].length-1] > 12) rp['range'] = rp['range']+1;
    $.ajax({
      url: app.API.SEASONAGG,
      data: {params:JSON.stringify(rp)},
      success: function(response){
        response = response.time_series;
        var series = []
        for (var j=0;j<response.series[0].length;j++){
          dseries = []
          for(var i=0;i<response.series.length;i++){
            dseries.push(Math.round(response.series[i][j]*100)/100)
          }
          series.push({
            name:response.names[j],
            data:dseries,
            color:AGGCOLORS[response.names[j]]
          });
        }
        // console.log(series)
        var options = {
          chartTitle: args.title,
          chart: {type: 'column',
            backgroundColor: 'rgba(255,255,255,0)',
            style: { "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif", "fontSize": "10px" },
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false},
          title: {text: null},
          xAxis: {categories: response.categories},
          yAxis: {
            min: 0,
            max: 100,
            title: {text: 'Percentage Area Covered'},
            stackLabels: {
              enabled: true,
              style: {
                fontWeight: 'bold',
                color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
              }
            }
          },
          legend: {
              align: 'right',
              verticalAlign: 'top',
              backgroundColor: (Highcharts.theme && Highcharts.theme.background2) || 'white',
              borderColor: '#CCC',
              borderWidth: 1,
              shadow: false
          },
          tooltip: {
              headerFormat: '<b>{point.x}</b><br/>',
              pointFormat: '{series.name}: {point.y}<br/>Total: {point.stackTotal}'
          },
          plotOptions: {
              column: {
                  stacking: 'normal',
                  dataLabels: {
                      enabled: true,
                      color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white'
                  }
              }
          },
          series: series
        };
        app.addGraphOnDiv(args.div,args.ref,options);
      }
    })
  }

  app.getPercentageOfNormal = function(args){
    var rp = {};
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
    if (args['lbp']!== undefined) rp['lbp'] = args['lbp'];
    // set minVal
    if (args['hbp']!== undefined) rp['hbp'] = args['hbp'];

    $.ajax({
      url: app.API.PNORMAL,
      data: {params:JSON.stringify(rp)},
      success: function(response){
        response = response.time_series;
        response.series = response.series.map(function(num){return Math.round(num*100)/100;});
        var options = {
          chartTitle: args.title,
          chart: {polar:true,
            type:'line',
            backgroundColor: 'rgba(255,255,255,0)',
            style: { "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif", "fontSize": "10px" },
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
          },
          title: {text: null},
          xAxis: {categories: response.categories,tickmarkPlacement: 'on'},
          yAxis: {min: 0,max: 200,title: null,lineWidth: 0,gridLineInterpolation: 'polygon'},
          legend: {enabled:false},
          tooltip: {
              headerFormat: '<b>{point.x}</b><br/>',
              pointFormat: '{series.name}: {point.y}<br/>Total: {point.stackTotal}'
          },
          series: [{name:'Percentage of Normal', data:response.series, pointPlacement:'on'}]
        };
        app.addGraphOnDiv(args.div,args.ref,options);
      }
    })
  }

  app.updateDropdownBinding = function(e){
    var selectedIndices = [
      $('#selectindex1').val(),
      $('#selectindex2').val(),
      $('#selectindex3').val(),
      $('#selectindex4').val(),
    ];
    for (var i=0; i<selectedIndices.length;i++){
      $(".bound-dropdown option").removeAttr('disabled');
    }
    for (var i=0; i<selectedIndices.length;i++){
      for (var j=0; j<selectedIndices.length;j++){
        if (i==j) continue;
        var q = j+1;
        var val = $('#selectindex'+(i+1)).val();
        $("#selectindex"+q+" option[value="+val+"]").attr('disabled','disabled');
      }
    }
  }

  // update the URL of application based on options
  app.updateURL = function(){
    let l0 = app.URLparams['c'];
    var geom = app.URLparams['d'];
    // let period = $("#selectdataset").val();
    let period = $("input[name=periodicity]:checked").val();
    let year = $("#selectyear").val();
    let start = $("#startDate").val().split("/").map(app.parseIntArr);
    let end = $("#endDate").val().split("/").map(app.parseIntArr);
    if (end[1]>start[1]) end[0]+=12;
    let selectedIndices = [
      $("#selectindex1").val(),
      $("#selectindex2").val(),
      $("#selectindex3").val(),
      $("#selectindex4").val(),
    ];
    let indices = selectedIndices.join(',');app.URLparams = {
      'c':l0,
      'd':geom,
      'p':period,
      'y':year,
      'sd':start[0],
      'ed':end[0],
      'i':indices,
    }
    let url = app.baseURL+"?c="+l0+
            "&d="+geom+
            "&p="+period+
            "&y="+year+
            "&sd="+start[0]+
            "&ed="+end[0]+
            "&i="+indices;
    if (document.location.href!=url) window.history.pushState({}, 'Nepal', url);
    else window.history.replaceState({}, 'Nepal', url);
  }

}

app.initiUI = function(){

  $('.bound-dropdown').empty();
  for (var i=0; i<INDICES.length;i++){
    $('.bound-dropdown').append('<option value="'+INDICES[i][0]+'">'+INDICES[i][1]+'</option>');
  }

  var indices = app.URLparams['i'].split(',');
  $('#selectindex1').val(indices[0]);
  $('#selectindex2').val(indices[1]);
  $('#selectindex3').val(indices[2]);
  $('#selectindex4').val(indices[3]);

  $('.bound-dropdown').on('change', function(e){app.updateDropdownBinding(e)});

  app.updateDropdownBinding();

  $("#startDate").MonthPicker({ Button: false,
    MinMonth: new Date(app.URLparams.y,0),
    MaxMonth: new Date(app.URLparams.y,11),
    OnAfterChooseMonth: function( e ){app.onStartChanged(e);}});
  $("#endDate").MonthPicker({ Button: false,
    MinMonth: new Date(app.URLparams.y,0),
    MaxMonth: new Date(parseInt(app.URLparams.y)+1,11)});
  // $(".datepicker").on('change', function(e){app.onRangeChanged(e);});
  $("#startDate").val(app.getDateString(app.URLparams.sd,app.URLparams.y));
  $("#endDate").val(app.getDateString(app.URLparams.ed,app.URLparams.y));
  app.onStartChanged();
  app.map = L.map('map-container').setView([27, 84], 4);
  app.topMap = L.map('top-map-container', {zoomControl: false, attributionControl:false}).setView([27, 84], 4);
  // light theme basemap
  app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/ciiibvf1k0011alki4gp6if1s/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // satellite streets basemap
  // app.baseMap = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  // app.baseMap2 = L.tileLayer('https://api.mapbox.com/styles/v1/banmedo/cjbkm07iu27kp2sqzrxsyteiv/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYmFubWVkbyIsImEiOiJhSklqeEZzIn0.rzfSxO3cVUhghA2sJN378A');
  app.baseMap.addTo(app.map);
  // district WMS
  let layername = 'geonode:nepal_administrative_boundaries_level_3';
  // district wms layer
  app.districtWMS = L.tileLayer.wms("https://geonode.wfp.org/geoserver/wms/?",{
    layers:layername,
    transparent:true,
    format:'image/png',
  });
  app.districtWMS.addTo(app.map);

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
  app.parseParameters();
  app.initializeVariables();
  app.createHelpers();
  app.initiUI();
  //app.fetchCropCalendar();
  app.addHandlers();
  $(".app-title").append("- "+app.URLparams.c);
  $("#curlink").prop('href',$("#curlink").prop('href')+"/?c="+app.URLparams.c);
  $("#sealink").prop('href',$("#sealink").prop('href')+"/?c="+app.URLparams.c);
  $("#outlink").prop('href',$("#outlink").prop('href')+"/?c="+app.URLparams.c);
  // app.computeClicked();
});
