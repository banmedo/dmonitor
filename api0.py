# Define your REST API endpoints here.
# In the comments below is an example.
# For more information, see:
# http://docs.tethysplatform.org/en/dev/tethys_sdk/rest_api.html
"""
from django.http import JsonResponse
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes

@api_view(['GET'])
@authentication_classes((TokenAuthentication,))
def get_data(request):
    '''
    API Controller for getting data
    '''
    name = request.GET.get('name')
    data = {"name": name}
    return JsonResponse(data)
"""

from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
import requests
import json
import os, hashlib
import sys

import rasterio
from rasterstats import zonal_stats
import fiona
import gdal
import datetime,fnmatch
import time,calendar
import sys
import os, shutil
from ftplib import FTP
import numpy as np
from itertools import groupby
import tempfile, shutil,sys
import calendar
from netCDF4 import Dataset
import gdal
import osr
import ogr
import requests
import rasterio
import random
import ast
from rasterstats import zonal_stats
import geojson
import json
import math
from shapely.geometry import Point

BLDAS_LIB_SOURCE = 'E:\\nkdev\\soft\\tethys\\Tethys\\tethysApps\\BLDAS\\tethysapp'
# CURRENT_FOLDER = os.path.dirname(os.path.realpath(__file__))
# BLDAS_LIB_SOURCE = os.path.realpath(os.path.join(CURRENT_FOLDER, "..", "..", "..","BLDAS","tethysapp"))
if (not BLDAS_LIB_SOURCE in sys.path):
    sys.path.append(BLDAS_LIB_SOURCE)
from bldas_explorer import utils as bldas_utils

ROOT_DIR = "E:/nkdev/dtest"

def get_variables_meta():
    db_file = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'public/data/var_info.txt')
    variable_list = []
    with open(db_file, mode='r') as f:
        f.readline()  # Skip first line

        lines = f.readlines()

    for line in lines:
        if line != '':
            line = line.strip()
            linevals = line.split('|')
            variable_id = linevals[0]
            display_name = linevals[1]
            units = linevals[2]
            gs_id = linevals[3]
            start = linevals[4]
            end = linevals[5]
            vmin = linevals[6]
            vmax = linevals[7]
            scale = calc_color_range(float(vmin),float(vmax))
            variable_list.append({
                'id': variable_id,
                'display_name': display_name,
                'units': units,
                'gs_id': gs_id,
                'start':start,
                'end':end,
                'min':vmin,
                'max':vmax,
                'scale':scale
            })

    return variable_list

def calc_color_range(min,max):

    interval = float(abs((max - min) / 20))

    if interval == 0:
        scale = [0] * 20
    else:
        scale = np.arange(min, max, interval).tolist()

    return scale

def last_day_of_month(any_day):
    next_month = any_day.replace(day=28) + datetime.timedelta(days=4)  # this will never fail
    return next_month - datetime.timedelta(days=next_month.day)

def convertEpochToJulianDay(epochTime):
    return int(time.strftime("%j",time.gmtime(epochTime)))

def convertDayMonthYearToEpoch(day,month,year):
    return float(datetime.date(year, month, day).strftime("%s"))

def getLastDayOfMonth(month,year):
    monthToProcess = month+1
    yearToProcess = year
    if (month == 12):
        monthToProcess = 1
        yearToProcess = year+1
    epochTime = float(datetime.date(yearToProcess, monthToProcess, 1).strftime("%s"))-86400
    return int(time.strftime("%d",time.gmtime(epochTime)))

def getIndexesBasedOnEpoch(startEpochTime, endEpochTime):
        jStart = convertEpochToJulianDay(startEpochTime)
        jEnd = convertEpochToJulianDay(endEpochTime)
        start = int(jStart / 10.)
        end = int(math.ceil((jEnd) / 10.))
        if (start == end):
            return [start]
        return range(start, end)

def getIndexBasedOnEpoch(startEpochTime):
        return int(convertEpochToJulianDay(startEpochTime) / 10.)

def getIndexBasedOnDate(day, month, year):
    decad = None
    if int(day) <= int(10):
        decad = int(1)
    elif int(day) <= int(20) and int(day) > int(10) and int(month) != int(2):
        decad = int(2)
    elif int(day) <= int(31) and int(day) > int(20) and int(month) != int(2):
        decad = int(3)
    elif int(day) <= int(20) and int(day) > int(10) and int(month) == int(2):
        decad = int(2)
    elif int(day) <= int(29) and int(day) > int(20) and int(month) == int(2):
        decad = int(3)

    return getIndexBasedOnDecad(decad, month, year)

def getIndexBasedOnDecad(decad, month, year):
    tIn = [x for x in range(0, 36)]
    decadChunks = [tIn[i:i + 3] for i in range(0, len(tIn), 3)]

    return int(decadChunks[int(month) - 1][int(decad) - 1])

def getDateBasedOnIndex(index, year):
    tIn = [x for x in range(0, 36)]
    decadChunks = [tIn[i:i + 3] for i in range(0, len(tIn), 3)]
    decadIndex = [[i, j] for i, lst in enumerate(decadChunks) for j, pos in enumerate(lst) if pos == index]
    month = int((decadIndex)[0][0]) + 1
    decad = int((decadIndex)[0][1]) + 1
    if int(decad) != int(3):
        return datetime.datetime(year, month, 10) + datetime.timedelta(decadIndex[0][1] * 10.)
    else:
        any_day = datetime.datetime(year, month, 10)
        next_month = any_day.replace(day=28) + datetime.timedelta(days=4)
        return next_month - datetime.timedelta(days=next_month.day)

def indexAndYearToDate(year, index):
    return datetime.date(year, 1, 1) + datetime.timedelta(days=index * 10.)

def getIndexesBasedOnDate(daystart, monthstart, yearstart, dayend, monthend, yearend):
    return getIndexesBasedOnEpoch(convertDayMonthYearToEpoch(daystart, monthstart, yearstart),
                                       convertDayMonthYearToEpoch(dayend, monthend, yearend))

def get_mask_data(country, suffix, input_folder, reference_file):

    # open mask file
    base_folder = os.path.dirname(os.path.realpath(__file__))
    mask_folder = os.path.join(base_folder,'masks')
    base_mask = os.path.join(mask_folder, 'Agr_'+country+'.tif')
    reprojected_file = base_mask.replace( ".tif", "_"+suffix+".tif" )
    if (os.path.isfile(reprojected_file)):
        mask_ds = rasterio.open(reprojected_file)
        if mask_ds is None:
            raise IOError, "GDAL could not open mask file %s " \
                % mask
    else:
        mask_ds = get_reprojected_image(os.path.join(input_folder,reference_file),base_mask,suffix, nodata=255)
        mask_ds = rasterio.open(mask_ds)
    # load the mask data to an np array
    mask_data = mask_ds.read(1)
    mask_NDV = 255

    return (mask_data, mask_NDV)

def get_reprojected_image(master, slave, variable, nodata=None, res=None):
    slave_ds = gdal.Open( slave )
    if slave_ds is None:
        raise IOError, "GDAL could not open slave file %s " \
            % slave

    master_ds = gdal.Open( master )
    if master_ds is None:
        raise IOError, "GDAL could not open master file %s " \
        % master

    slave_proj = slave_ds.GetProjection()
    slave_geotrans = slave_ds.GetGeoTransform()
    data_type = slave_ds.GetRasterBand(1).DataType
    n_bands = slave_ds.RasterCount

    master_proj = master_ds.GetProjection()
    master_geotrans = master_ds.GetGeoTransform()
    w = master_ds.RasterXSize
    h = master_ds.RasterYSize
    if res is not None:
        master_geotrans[1] = float( res )
        master_geotrans[-1] = - float ( res )

    # dst_ds = gdal.GetDriverByName('MEM').Create('',
    #                                             w, h, n_bands, data_type)

    dst_file = slave.replace( ".tif", "_"+variable+".tif" )
    dst_ds = gdal.GetDriverByName('GTiff').Create(dst_file,
                                                w, h, n_bands, data_type)

    dst_ds.SetGeoTransform( master_geotrans )
    dst_ds.SetProjection( master_proj)
    if (nodata != None):
        dst_ds.GetRasterBand(1).SetNoDataValue(nodata)
    else:
        dst_ds.SetNoDataValue(slave_ds.GetRasterBand(1).GetNoDataValue())

    reprojected = gdal.ReprojectImage( slave_ds, dst_ds, slave_proj,
                         master_proj, gdal.GRA_NearestNeighbour)
    dst_ds = None
    del master_ds
    return dst_file

def get_masked_polygon_statsRange(suffix,geom_data,interval,year, mon, rang, country):

    json_obj = {}
    if rang >= 12: # number of months to expand, max is 12
        rang = 12
    mon = int(mon)

    input_folder = os.path.join(ROOT_DIR,str(suffix) + '_' + str(interval))
    file_list = os.listdir(input_folder)
    months = []

    if interval == 'mm' or interval == '3m':
        # for pp in range(1, 13):
        for pp in range(mon, mon + rang):
            if pp > 12: #if mooth is 12 then go to next year
                mn = pp - 12
                curYr = year + 1
            else:
                mn = pp
                curYr = year
            months.append(last_day_of_month(datetime.date(int(curYr), mn, 1)))

    mask_data, mask_NDV = get_mask_data(country, suffix, input_folder, file_list[0])

    min = []
    mean = []
    max = []
    median = []
    jj = 0
    for i, file in enumerate(sorted(file_list)):
        pattern = ''
        for pp in range(mon, mon + rang):
            if pp > 12: #if mooth is 12 then go to next year
                mn = pp - 12
                curYr = int(year) + 1
            else:
                mn = pp
                curYr = year
            pattern = str(curYr) + str(format(mn,'02d') + '*')
            if file.endswith('.tif') and fnmatch.fnmatch(file, pattern):
                # load raster into memory
                master_path = os.path.join(input_folder,file)
                master_ds = rasterio.open(master_path)
                master_data = master_ds.read(1)
                master_profile = master_ds.profile
                # convert the pixels that should be masked to NDV
                master_data[mask_data==mask_NDV] = master_profile['nodata']
                # compute zonal stats by passing the updated array
                # also specify nodata value to skip them
                stats = zonal_stats(geom_data, master_data,
                    affine=master_profile['transform'], stats="min mean max median",
                    nodata=master_profile['nodata'])
                time_stamp = None

                if interval == 'dd':
                    yearDD = file.split('.')[0][:4]
                    dekad = file.split('.')[0][-2:]
                    month = file.split('.')[0][4:6]
                    idx = getIndexBasedOnDecad(int(dekad),int(month),int(yearDD))
                    cur_date = getDateBasedOnIndex(int(idx),int(yearDD))
                    # start_date = year + '01' + '01'
                    # cur_date = datetime.datetime.strptime(start_date, '%Y%m%d') + datetime.timedelta(days=int(i * 10))
                    time_stamp = (time.mktime(cur_date.timetuple()) * 1000)

                if interval == 'mm':
                    time_stamp = (time.mktime(months[jj].timetuple()) * 1000)

                if interval == '3m':
                    time_stamp = (time.mktime(months[jj].timetuple()) * 1000)

                min.append([time_stamp, stats[0]["min"]])
                max.append([time_stamp, stats[0]["max"]])
                median.append([time_stamp, stats[0]["median"]])
                mean.append([time_stamp, stats[0]["mean"]])
                jj = jj + 1
                break

    json_obj["min_data"] = sorted(min)
    json_obj["max_data"] = sorted(max)
    json_obj["median_data"] = sorted(median)
    json_obj["mean_data"] = sorted(mean)

    return json_obj



'''
Function to get the list of geometries based on countries in the Shapes
folder.
'''
def getGeomList(request):
    country = request.GET.get('country')
    base_folder = os.path.dirname(os.path.realpath(__file__))
    geomFolder = os.path.join(base_folder,'public','Shapes', country)
    filelist = os.listdir(geomFolder)
    filelist = list(map(lambda x: x[:-8], filelist))
    return JsonResponse(filelist, safe=False)

'''
Function to get zonal statistics of specified varriables based on the supplied
geometry name from external BLDAS source.
'''
def getJsonFromBLDAS(request):
    # for public tethys
    # url = 'http://tethys.icimod.org/apps/bldas-explorer/api/getMaskedPolygonStatsRangePost/'
    url = 'http://192.168.10.74/getMaskedPolygonStatsRangePost/'
    csrf = '70ea40c68fa50a3d0bde25847ade8bbe56499d0a'
    # for local
    # url = 'http://localhost:8005/apps/bldas-explorer/api/getMaskedPolygonStatsRangePost/'
    # csrf = '09124cef8ac2441386af6fb0d1cdba290069739e'

    params = json.loads(request.GET.get('params'))
    type = params['type']
    base_folder = os.path.dirname(os.path.realpath(__file__))
    # feature = shp.getBounds(params['geom'])

    feature_file = os.path.join(base_folder,'public','Shapes', params['country'], params['geom']+".geojson")
    with open(feature_file) as f:
        feature = json.load(f)
        geometry = feature["features"][0]["geometry"]
    params['geom'] = json.dumps(geometry)

    # geom = '/home/kshakya/tethys/tethysapps/BLDAS/tethysapp/bldas_explorer/public/data/afganistan/'
    # params['geom'] = geom + params['geom'] + '.geojson'

    reqhash = hashlib.sha224(request.build_absolute_uri().encode('utf-8')).hexdigest()
    cachefile = os.path.join(base_folder,'Cache',reqhash+'.json')
    if (not os.path.exists(cachefile)):
        # params['geom'] = '{"type":"Polygon","coordinates":[[[86.41083984374998,27.776656735395832],[85.70771484375,26.721832698918973],[87.50947265624998,26.721832698918973],[87.11396484374998,27.737768254316606],[86.41083984374998,27.776656735395832]]]}'
        response = {}
        if (type == 'POST'):
            response = requests.post(url,data = params, headers = {'Authorization': 'Token '+csrf} ).json()
        else:
            response = requests.get(url, params=params).json()

        # save successful response to cache
        # if (params['year']!="2018") and (not 'error' in response.keys()):
        #     with open(cachefile, "w") as f:
        #         json.dump(response, f)

        # return HttpResponse(response)
        return JsonResponse(response)
    else:
        with open(cachefile) as f:
            data = json.load(f)
            return JsonResponse(data)

'''
Function to get area under specified range for specified index over agricultural
mask from external BLDAS source
'''
def getAreaUnderFromBLDAS(request):
    # for public tethys
    # url = 'http://tethys.icimod.org/apps/bldas-explorer/api/getMaskedPolyAreaRangePost/'
    url = 'http://192.168.10.74/getMaskedPolyAreaRangePost/'
    csrf = '70ea40c68fa50a3d0bde25847ade8bbe56499d0a'
    # for local
    # url = 'http://localhost:8005/apps/bldas-explorer/api/getMaskedPolyAreaRangePost/'
    # csrf = '09124cef8ac2441386af6fb0d1cdba290069739e'

    params = json.loads(request.GET.get('params'))
    # params = {"interval":"dd","year":2017,"type":"POST","country":"Afghanistan","geom":"Badakhshan","month":1,"range":12, "variable":"temp", "maxVal":300, "minVal":273};

    type = params['type']

    base_folder = os.path.dirname(os.path.realpath(__file__))
    reqhash = hashlib.sha224(request.build_absolute_uri().encode('utf-8')).hexdigest()
    cachefile = os.path.join(base_folder,'Cache',reqhash+'.json')

    # check if cached data exists or not
    if (not os.path.exists(cachefile)):
        # first get geometry
        feature_file = os.path.join(base_folder,'public','Shapes', params['country'], params['geom']+".geojson")
        with open(feature_file) as f:
            feature = json.load(f)
            geometry = feature["features"][0]["geometry"]
        params['geom'] = json.dumps(geometry)
        # params['geom'] = '{"type":"Polygon","coordinates":[[[82.56562500000001,29.26317557204203],[82.1701171875,28.532188544386088],[83.40058593750001,27.99029461379024],[83.532421875,28.7635821425677],[82.56562500000001,29.26317557204203]]]}'

        # geom = '/home/kshakya/tethys/tethysapps/BLDAS/tethysapp/bldas_explorer/public/data/afganistan/'
        # params['geom'] = geom + params['geom'] + '.geojson'

        response = {}
        if (type == 'POST'):
            response = requests.post(url,data = params, headers = {'Authorization': 'Token '+csrf} )#.json()
        else:
            response = requests.get(url, params=params).json()

        # save successful response to cache
        # if (params['year']!="2018") and (not 'error' in response.keys()):
        #     with open(cachefile, "w") as f:
        #         json.dump(response, f)
        # return JsonResponse(response)
        return HttpResponse(response)
    else:
        with open(cachefile) as f:
            data = json.load(f)
            return JsonResponse(data)

'''
Function to get zonal statistics of specified varriables based on the supplied
geometry name from internal BLDAS source.
'''
def getJsonFromBLDAS_External(request):
    json_obj = {}

    # specify cache directory and cache file
    base_folder = os.path.dirname(os.path.realpath(__file__))
    reqhash = hashlib.sha224(request.build_absolute_uri().encode('utf-8')).hexdigest()
    cachefile = os.path.join(base_folder,'Cache',reqhash+'.json')

    if (not os.path.exists(cachefile)):
        # parse the supplied parameters
        params = json.loads(request.GET.get('params'))
        # parse the geometry from filename
        feature_file = os.path.join(base_folder,'public','Shapes', params['country'], params['geom']+".geojson")
        with open(feature_file) as f:
            feature = json.load(f)
            geometry = feature["features"][0]["geometry"]
        params['geom'] = json.dumps(geometry)

        suffix = params['variable']
        interval = params['interval']  # period dd, mm, yy
        interval = interval.lower()
        year = int(params['year'])
        month = int(params['month'])
        range = int(params['range'])
        geom = params['geom']
        country = params['country']

        try:
            # ts = bldas_utils.get_masked_polygon_statsRange(suffix, geom, interval, year, month, range, country)
            ts = get_masked_polygon_statsRange(suffix, geom, interval, year, month, range, country)

            json_obj["time_series"] = ts
            json_obj["success"] = "success"
            json_obj["interval"] = interval

            # save successful response to cache
            if (params['year']!="2018"):
                with open(cachefile, "w") as f:
                    json.dump(json_obj, f)
        except Exception as e:
            json_obj["error"] = "Error processing request: " + str(e)
    else:
        with open(cachefile) as f:
            json_obj = json.load(f)

    return JsonResponse(json_obj)


'''
Function to get area under specified range for specified index over agricultural
mask from internal BLDAS source
'''
def getAreaUnderFromBLDAS_External(request):
    json_obj = {}

    # specify cache directory and cache file
    base_folder = os.path.dirname(os.path.realpath(__file__))
    reqhash = hashlib.sha224(request.build_absolute_uri().encode('utf-8')).hexdigest()
    cachefile = os.path.join(base_folder,'Cache',reqhash+'.json')

    if (not os.path.exists(cachefile)):
        # parse the supplied parameters
        params = json.loads(request.GET.get('params'))
        # parse the geometry from filename
        feature_file = os.path.join(base_folder,'public','Shapes', params['country'], params['geom']+".geojson")
        with open(feature_file) as f:
            feature = json.load(f)
            geometry = feature["features"][0]["geometry"]
        params['geom'] = json.dumps(geometry)

        suffix = params['variable']
        interval = params['interval']  # period dd, mm, yy
        interval = interval.lower()
        year = params['year']
        month = params['month']
        range = params['range']
        geom = params['geom']
        country = params['country']
        minVal = None
        if (params['minVal']):
            minVal = float(params['minVal'])
        maxVal = None
        if (params['maxVal']):
            maxVal = float(params['maxVal'])

        try:
            # ts = {}
            ts = bldas_utils.get_masked_polygon_areaRange(suffix, geom, interval, year, month, range, minVal, maxVal, country)

            json_obj["time_series"] = ts
            json_obj["success"] = "success"
            json_obj["interval"] = interval

            # save successful response to cache
            if (params['year']!="2018"):
                with open(cachefile, "w") as f:
                    json.dump(json_obj, f)
        except Exception as e:
            json_obj["error"] = "Error processing request: " + str(e)
    else:
        with open(cachefile) as f:
            json_obj = json.load(f)

    return JsonResponse(json_obj)
