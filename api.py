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

HOSTADDRESS = 'http://192.168.10.74:8001/'

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
    url = HOSTADDRESS+'getMaskedPolygonStatsRangePost/'
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
        if (params['year']!="2018") and (not 'error' in response.keys()):
            with open(cachefile, "w") as f:
                json.dump(response, f)

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
    url = HOSTADDRESS+'getMaskedPolyAreaRangePost/'
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
            response = requests.post(url,data = params, headers = {'Authorization': 'Token '+csrf} ).json()
        else:
            response = requests.get(url, params=params).json()

        # save successful response to cache
        if (params['year']!="2018") and (not 'error' in response.keys()):
            with open(cachefile, "w") as f:
                json.dump(response, f)
        return JsonResponse(response)
        # return HttpResponse(response)
    else:
        with open(cachefile) as f:
            data = json.load(f)
            return JsonResponse(data)


'''
Function to get LTA stats under specified range for specified index over agricultural
mask from external BLDAS source
'''
def getLTAStats(request):
    # for public tethys
    # url = 'http://tethys.icimod.org/apps/bldas-explorer/api/getMaskedPolygonStatsRangePost/'
    url = HOSTADDRESS+'getMaskedPolygonStatsLTA/'
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

    reqhash = hashlib.sha224('LTA'+request.build_absolute_uri().encode('utf-8')).hexdigest()
    cachefile = os.path.join(base_folder,'Cache',reqhash+'.json')
    if (not os.path.exists(cachefile)):
        # params['geom'] = '{"type":"Polygon","coordinates":[[[86.41083984374998,27.776656735395832],[85.70771484375,26.721832698918973],[87.50947265624998,26.721832698918973],[87.11396484374998,27.737768254316606],[86.41083984374998,27.776656735395832]]]}'
        response = {}
        if (type == 'POST'):
            response = requests.post(url,data = params, headers = {'Authorization': 'Token '+csrf} ).json()
        else:
            response = requests.get(url, params=params).json()

        # save successful response to cache
        if (params['year']!="2018") and (not 'error' in response.keys()):
            with open(cachefile, "w") as f:
                json.dump(response, f)

        # return HttpResponse(response)
        return JsonResponse(response)
    else:
        with open(cachefile) as f:
            data = json.load(f)
            return JsonResponse(data)
