var VISPARAMS = {
  'ch2Spi': [
    {color:"#FFFFFF", quantity:"-9999", label:["No Data"], opacity:"0"},
    {color:"#FF0000", quantity:"-2", label:["-2 and less","Extremely Dry"], opacity:"1"},
    {color:"#FB8420", quantity:"-1.5", label:["-2 to -1.5","Severely Dry"], opacity:"1"},
    {color:"#F9FF42", quantity:"-1", label:["-1.5 to -1","Moderately Dry"], opacity:"1"},
    {color:"#BFBFBF", quantity:"1", label:["-1 to 1","Near Normal"], opacity:"1"},
    {color:"#00FF43", quantity:"1.5", label:["1 to 1.5","Moderately Wet"], opacity:"1"},
    {color:"#00FFFF", quantity:"2", label:["1.5 to 2","Severely Wet"], opacity:"1"},
    {color:"#3700f1", quantity:"3", label:["2 and above","Extremely Wet"], opacity:"1"},
    // {color:"#FFFFFF", quantity:"-9999", label:"No Data", opacity:"0"},
    // {color:"#FF0000", quantity:"-2", label:"Extreme Dry", opacity:"1"},
    // {color:"#FF006F", quantity:"-1.5", label:"Severe Dry", opacity:"1"},
    // {color:"#DC00C9", quantity:"-1", label:"Moderate Dry", opacity:"1"},
    // {color:"#4A62FF", quantity:"1", label:"Near Normal", opacity:"1"},
    // {color:"#0082FF", quantity:"1.5", label:"Moderate Wet", opacity:"1"},
    // {color:"#008BE4", quantity:"2", label:"Severe Wet", opacity:"1"},
    // {color:"#0000FF", quantity:"3", label:"Extreme Wet", opacity:"1"},
  ],
  'temp': [
    {color:"#FFFFFF", quantity:"-9999", label:["No Data"], opacity:"0"},
    {color:"#0000FF", quantity:"273", label:["less than 273","Extreme Cold"], opacity:"1"},
    {color:"#FF0000", quantity:"323", label:["273 or more", "Extreme Hot"], opacity:"1"},
  ],
  'rain': [
    {color:"#FFFFFF", quantity:"-9999", label:["No Data"], opacity:"0"},
    {color:"#FF0000", quantity:"100", label:["less than 100","Extreme Cold"], opacity:"1"},
    {color:"#0000FF", quantity:"400", label:["100 or more","Extreme Hot"], opacity:"1"},
  ],
  'evap': [
    {color:"#FFFFFF", quantity:"-9999", label:["No Data"], opacity:"0"},
    {color:"#FF0000", quantity:"100", label:["less than 100"], opacity:"1"},
    {color:"#0000FF", quantity:"400", label:["100 or more"], opacity:"1"},
  ],
  'soilMoist': [
    {color:"#FFFFFF", quantity:"-9999", label:["No Data"], opacity:"0"},
    {color:"#FF0000", quantity:"5", label:["less than 20","less than 20"], opacity:"1"},
    {color:"#D77431", quantity:"20", label:["20 to 20", "less than 40"], opacity:"1"},
    {color:"#7EB154", quantity:"70", label:["40 to 20","less than 60"], opacity:"1"},
    {color:"#1CADC8", quantity:"90", label:["60 to 20","less than 80"], opacity:"1"},
    {color:"#0000FF", quantity:"100", label:["80 or more","80 or more"], opacity:"1"},
  ],
  'none': [],
};

var WMSLAYERS = {
  "ch2Spi" : "SPI",
  "temp" : "Temperature (&deg;C)",
  "rain" : "Rainfall (mm/day)",
  "evap" : "Evapotranspiration",
  "soilMoist" : "Soil Moisture",
  "none" : "No Layers",
}

//helper function for aggregating data over mapping

var VALUESCALE = {
  'temp': function(x){return x-273;},
  'emodisNdvi': function (data){return (data/200) -0.1;},
  'ndviAnomaly': function (data){return -1*(data/200);},
  'rainfallAggregate' : function(data){return app._getAggregated('aggregate_rain', data);}
}

var INDICES = [
  ["tempExtreme","Temperature (min, max)"],
  ["rain","Rainfall"],
  ["soilMoist","Soil Moisture"],
  ["evap","Total Evapotranspiration"],
  ["NDVI","NDV"],
  ["tempMean", "Mean Temperature" ],
  ["ndviAnomaly","NDVI Anomaly"],
  // ["spi-1To1","Area Under SPI (-1 to 1)"]
]
