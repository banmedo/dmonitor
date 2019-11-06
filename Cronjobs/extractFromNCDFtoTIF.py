import os
import netCDF4
import datetime
import calendar
import numpy
import gdal, gdalnumeric
import osr, ogr, json, statistics

data = {"anominterval":"quartly","year":2000,"type":"POST","distnum":"Nepall2Jumla","month":10,"range":11,"variable":"Tair_f_tavg"}
inputBase = "\\\\192.168.10.74\Data4mUS\zData\SLDAS"
destBase = "E:\\SLDAS\\nf"
# destBase = "E:/convert/"
# variables = {"evap":"Evap_tavg"}
# periods = {"dd":"dekad"}
variables = {
    "evap":"Evap_tavg",
    "soilMoist":"SoilMoist_inst",
    "rain":"Rainf_f_tavg",
    "temp":"Tair_f_tavg",
    "tempMax":"Tair_f_tavg_max",
    "tempMin":"Tair_f_tavg_min"
    }
periods = {
    "dd":"dekad",
    "mm":"monthly",
    "3m":"quartly"
    }

def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def getTifName(retroname):
    return retroname[6:-2]+"tif"


def extractData(file, variable, period):
    #setting envs
    times = []
    units = ''
    inputFile = "Retro."+file[:-4]+".nc"
    var = variables[variable]
    outputPath = create_if_not_exists(os.path.join(destBase,"%s_%s"%(variable,period)))
    inputPath = os.path.join(inputBase,periods[period])

    # first check again if output file exists
    if (period == 'dd'):
        dnum = int(file[-6:-4])/10+1
        file = "%s%02d.tif"%(file[:-6],dnum)
    gtiffpath = os.path.join(outputPath, file)
    if (os.path.exists(gtiffpath)):
        return

    #read the input file
    # print(inputPath, outputPath)
    # open the netcdf and copy data from it
    nc_obj = netCDF4.Dataset(os.path.join(inputPath, inputFile), 'r')
    var_data = nc_obj.variables[var][:]
    lat = nc_obj.variables['lat'][:]
    lon = nc_obj.variables['lon'][:]

    # create the timesteps for the highcharts plot
    t_value = (nc_obj['time'].__dict__['units'])
    t_step = datetime.datetime.strptime(t_value, "days since %Y-%m-%d 00:00:00")
    times.append(calendar.timegm(t_step.utctimetuple()) * 1000)

    # format the array of information going to the tiff
    array = numpy.asarray(var_data)[0, :, :]
    array[array < -9000] = numpy.nan                # change the comparator to git rid of the fill value
    array = array[::-1]       # vertically flip the array so the orientation is right (you just have to, try it)

    # Creates geotiff raster file (filepath, x-dimensions, y-dimensions, number of bands, datatype)

    gtiffdriver = gdal.GetDriverByName('GTiff')
    new_gtiff = gtiffdriver.Create(gtiffpath, len(lon), len(lat), 1, gdal.GDT_Float32)
    # geotransform (sets coordinates) = (x-origin(left), x-width, x-rotation, y-origin(top), y-rotation, y-width)
    yorigin = lat.max()
    xorigin = lon.min()
    xres = lat[1] - lat[0]
    yres = lon[1] - lon[0]
    new_gtiff.SetGeoTransform((xorigin, xres, 0, yorigin, 0, -yres))

    # Set projection of the geotiff (Projection EPSG:4326, Geographic Coordinate System WGS 1984 (degrees lat/lon)
    new_gtiff.SetProjection(osr.SRS_WKT_WGS84)

    # actually write the data array to the tiff file and save it
    new_gtiff.GetRasterBand(1).WriteArray(array)      # write band to the raster (variable array)
    new_gtiff.GetRasterBand(1).SetNoDataValue(-9999)      # write band to the raster (variable array)
    new_gtiff.FlushCache()
    print("done for", file, variable, period)


for period in periods.keys():
    for variable in variables.keys():
        ncfiles = list(map(getTifName,os.listdir(os.path.join(inputBase,periods[period]))))
        tiffiles = os.listdir(create_if_not_exists(os.path.join(destBase,"%s_%s"%(variable,period))));
        remaining = [x for x in ncfiles if x not in tiffiles]
        if(len(remaining)>0):
            for f in remaining:
                try:
                    extractData(f, variable, period)
                except:
                    print("failed for",f,variable,period)
