var mapApp={};
mapApp.threddsbase ="http://tethys.icimod.org:7000/thredds/wms/saldasforecast/";
mapApp.AnimationTimeInterval = 1000; //ms
mapApp.geomCache = {};

mapApp.setMap = function(map){
  mapApp.map = map;
  mapApp.map.on('move',function(e){
    mapApp.submapRefactor();
  });
  mapApp.map.on('zoomend',function(e){
    // mapApp.submapRefactor();
    setTimeout(function(){mapApp.submapRefactor()},100);
  });
}

mapApp.setTopMap = function(map){
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  if (map.tap) map.tap.disable();
  document.getElementById('top-map-container').style.cursor='default';
  mapApp.topMap = map;
}

//update the selected geometry
mapApp.updateGeometry = function(l0,l1){
  // if(!l1) return;
  if (mapApp.activeLayer != undefined){
    mapApp.map.removeLayer(mapApp.activeLayer);
  }
  // if (mapApp.mapMask != undefined){
  //   mapApp.map.removeLayer(mapApp.mapMask);
  // }
  if (mapApp.geomCache[l1] != undefined){
    mapApp.activeLayer = L.geoJSON(mapApp.geomCache[l1],{color:'#222222',fillOpacity:"0"}).addTo(mapApp.map);
    mapApp.map.fitBounds(mapApp.activeLayer.getBounds());
    // applyMask(mapApp.geomCache[l1]);
  }else {
    if (mapApp.geomLoading != undefined) mapApp.geomLoading.abort();

    mapApp.geomLoading = $.ajax({
      dataType : 'json',
      url : '/static/dmlocal/Shapes/'+l0+'/'+l1+'.geojson',
      success: function(fcoll){
        mapApp.activeLayer = L.geoJson(fcoll,{color:'#222222',fillOpacity:"0", weight:"1.5"}).addTo(mapApp.map);
        mapApp.geomCache[l1] = fcoll;
        mapApp.map.fitBounds(mapApp.activeLayer.getBounds());
        // setTimeout(function(){mapApp.submapRefactor();},500);
        // applyMask(fcoll);
      }
    });
  }

  // function applyMask(fcoll){
  //   var latlngs = fcoll.features[0].geometry.coordinates[0].map(function(item){
  //     return new L.LatLng(item[1], item[0])
  //   });
  //   mapApp.mapMask = L.mask(latlngs);
  //   mapApp.mapMask.addTo(mapApp.map)
  // }
}

mapApp._getWMSSld = function(layername, style){
  var selectedStyle = VISPARAMS[style];
  var retText = '<StyledLayerDescriptor version="1.0.0"><NamedLayer><Name>'+layername+'</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="ramp">';
  for (var i = 0; i< selectedStyle.length;i++){
    var cMap = selectedStyle[i];
    retText += '<ColorMapEntry color="'+cMap.color+'" quantity="'+cMap.quantity+'" label="'+cMap.label+'" opacity="'+cMap.opacity+'"/>'
  }
  retText += '</ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
  return retText;
};

mapApp._getLegendSld = function(layername, style){
  var selectedStyle = VISPARAMS[style];
  var retText = '<StyledLayerDescriptor version="1.0.0"><NamedLayer><Name>'+layername+'</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="ramp">';
  for (var i = 0; i< selectedStyle.length;i++){
    var cMap = selectedStyle[i];
    if(cMap.opacity==0) continue;
    retText += '<ColorMapEntry color="'+cMap.color+'" quantity="'+cMap.quantity+'" label="'+cMap.label+'" opacity="'+cMap.opacity+'"/>'
  }
  retText += '</ColorMap></RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
  return retText;
};

mapApp._getSeries = function(variable,en){
  let wmsurl = mapApp.threddsbase + "monthly_" + en +".ncml";
  let wmsLayer = L.tileLayer.wms(wmsurl, {
      // version: '1.3.0',
      layers: variable,
      dimension: 'time',
      useCache: true,
      crossOrigin: false,
      format: 'image/png',
      transparent: true,
      opacity: 0.4,
      BGCOLOR: '0x000000',
      styles: 'boxfill/undefined',
      colorscalerange: BOUNDS[variable],
  });
  console.log(mapApp.topMap,wmsLayer);
  let timedLayer = L.timeDimension.layer.wms(wmsLayer, {
      name: 'time',
      requestTimefromCapabilities: true,
      updateTimeDimension: true,
      updateTimeDimensionMode: 'replace',
      cache: 20,
  }).addTo(app.map);
  return timedLayer;
}
mapApp._clearWMSLayers = function(){
  if (!mapApp.activeSeries) return;
  for (var i; i<mapApp.activeSeries.length; i++){
    mapApp.map.removeLayer(mapApp.activeSeries[i].wmsLayer);
  }
}


mapApp._addWMSLayers = function(){
  return;
  mapApp._clearWMSLayers();
  mapApp.isLayerAdded = [];
  for (var i = 0; i<mapApp.activeSeries.length; i++){
    mapApp.isLayerAdded.push(false);
  }
}

mapApp.mapVariableChanged = function(){
  if(mapApp.activeSeries) mapApp.map.removeLayer(mapApp.activeSeries);
  mapApp.selectedVariable = $("#selmapvar").val();
  mapApp.ensemble = $("#selecten").val();
  if (mapApp.selectedVariable != 'none')
    mapApp.activeSeries = mapApp._getSeries(mapApp.selectedVariable, mapApp.ensemble);

  mapApp.updateLegend();
}

mapApp.addVariableSelector = function(){
  if (!mapApp.variableSelector) mapApp.variableSelector = L.control({position: 'topright'});
  else mapApp.map.removeControl(mapApp.variableSelector);
  mapApp.variableSelector.onAdd = function (map) {
    var layerObject = WMSLAYERS;
    var availableLayers = Object.keys(layerObject);

    var div = L.DomUtil.create('div', 'info');
    // console.log(availableLayers);
    var innerText = '<select id="selmapvar" onchange="mapApp.mapVariableChanged()" style="padding:2px;border-radius:3px;border-color:white;box-shadow:0px 1px 5px rgba(0,0,0,0.4);">'
    mapApp.selectedVariable = availableLayers[0]
    for(var i=0; i< availableLayers.length;i++){
      innerText += '<option value='+availableLayers[i]+' >'+layerObject[availableLayers[i]]+'</option>'
    }
    innerText += '</select>'
    div.innerHTML += innerText;
    return div;
  };
  mapApp.variableSelector.addTo(mapApp.map);
  mapApp.mapVariableChanged()
}

mapApp.updateLegend = function(){
  if (!mapApp.legend) mapApp.legend = L.control({position: 'bottomright'});
  else mapApp.map.removeControl(mapApp.legend);

  if (mapApp.selectedVariable == 'none') return;

  mapApp.legend.onAdd = function (mapObj) {
      let div = L.DomUtil.create('div', 'legend');
      let url = mapApp.threddsbase + "monthly_"+mapApp.ensemble+".ncml";
      url = url + "?REQUEST=GetLegendGraphic&LAYER=" + mapApp.selectedVariable + "&PALETTE=undefined&COLORSCALERANGE=" + BOUNDS[mapApp.selectedVariable];
      url = url + "&LEGEND_OPTIONS=bgColor:0xFFFFFF"
      div.innerHTML = '<img class="legend-image" src="' + url + '" alt="legend" style="width:100%; float:right">';
      $(div).css('background','black');
      return div
  };
  mapApp.legend.addTo(mapApp.map);

  $('.legend-image').one("load", function() {
    var width = $('.legend-image').width()
    $('.legend-image').css('width',(width*0.7)+'px');
    $('.legend-image').off('mouseenter');
    $('.legend-image').off('mouseout');
    $('.legend-image').on('mouseenter',function(e){
      $('.legend-image').css('width',(width*1)+'px');
    });
    $('.legend-image').on('mouseout',function(e){
      $('.legend-image').css('width',(width*0.7)+'px');
    });
  });

  // var selectedStyle = VISPARAMS[mapApp.selectedVariable];
  //
  // mapApp.legend.onAdd = function (map) {
  //     var div = L.DomUtil.create('div', 'info legend');
  //     var innerText = '<span class="legend-text"><b>'+WMSLAYERS[mapApp.selectedVariable]+'</b></span><br><table class = "legend-table" >';
  //     var scalefun = VALUESCALE[mapApp.selectedVariable];
  //     // for (var i = selectedStyle.length-1; i>=0; i--) {
  //     //   cMap = selectedStyle[i];
  //     //   if (cMap.opacity>0) {
  //     //     innerText += '<tr class = "legend-row"><td class = "legend-symbol" style="background-color:'+cMap.color+';"></td>';
  //     //     innerText += '<td class = "legend-text legend-label">'+cMap.label.join('</td><td class="legend-text">')+'</td></tr>';
  //     //   }
  //     // }
  //     innerText += '</table>';
  //     div.innerHTML += innerText;
  //     return div;
  // };


  // expand legend on hover and prevent stacking
  $('.legend-image').off('mouseenter');
  $('.legend-image').off('mouseout');
  $('.legend-image').on('mouseenter',function(e){
    $('.legend-image').css('width','80%');
  });
  $('.legend-image').on('mouseout',function(e){
    $('.legend-image').css('width','70%');
  });
}

mapApp.submapRefactor = function(){
  var layers = mapApp.activeLayer._layers;
  var layerIndex = Object.keys(layers)[0];
  var polygonParts = layers[layerIndex]._parts[0];
  if (polygonParts && polygonParts.length > 0){
    var mapPaneElement = $(layers[layerIndex]._path).parent().parent().parent().parent();
    var mapTransformString = mapPaneElement.css("transform");
    var mapTransformArray = mapTransformString.split('(')[1].split(')')[0].split(',')
      .map(function(item){
        return parseInt(item);
      });
    var offsetX = mapTransformArray[mapTransformArray.length-2];
    var offsetY = mapTransformArray[mapTransformArray.length-1];
    var layerVertices = polygonParts.map(function(item){
      return (item.x+offsetX)+"px "+(item.y+offsetY)+"px";
    });
    $("#top-map-container").css("clip-path","polygon("+layerVertices.join(",")+")");
    $("#top-map-container").css("z-index","500");
    mapApp.topMap.flyTo(mapApp.map.getCenter(),mapApp.map.getZoom(),{animate:false,duration:0});
  }
  // console.log('refactored',$("#top-map-container").css("clip-path"));
}
