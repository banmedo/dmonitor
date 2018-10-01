from tethys_sdk.base import TethysAppBase, url_map_maker


class Dmlocal(TethysAppBase):
    """
    Tethys app class for Drought Monitor Local.
    """

    name = 'Drought Monitor Local'
    index = 'dmlocal:home'
    icon = 'dmlocal/images/icon.gif'
    package = 'dmlocal'
    root_url = 'dmlocal'
    color = '#2c3e50'
    description = 'Drought Monitor (Local)'
    tags = ''
    enable_feedback = False
    feedback_emails = []

    def url_maps(self):
        """
        Add controllers
        """
        UrlMap = url_map_maker(self.root_url)

        url_maps = (
            UrlMap(
                name='home',
                url='dmlocal',
                controller='dmlocal.controllers.minimum'
            ),
            UrlMap(
                name='addvanced',
                url='historical',
                controller='dmlocal.controllers.advanced'
            ),
            UrlMap(
                name='homeBak',
                url='old',
                controller='dmlocal.controllers.homeBak'
            ),
            UrlMap(
                name='geomList',
                url='api/getGeomList',
                controller='dmlocal.api.getGeomList'
            ),
            UrlMap(
                name='Stats',
                url='api/getJsonFromAPI',
                controller='dmlocal.api.getJsonFromBLDAS'
            ),
            # UrlMap(
            #     name='geomList',
            #     url='api/getJsonFromAPIExt',
            #     controller='dmlocal.api.getJsonFromBLDAS_External'
            # ),
            UrlMap(
                name='AreaUnder',
                url='api/getAreaUnder',
                controller='dmlocal.api.getAreaUnderFromBLDAS'
            ),
            # UrlMap(
            #     name='geomList',
            #     url='api/getAreaUnderExt',
            #     controller='dmlocal.api.getAreaUnderFromBLDAS_External'
            # ),
            UrlMap(
                name='LTAstats',
                url='api/getLTAStats',
                controller='dmlocal.api.getLTAStats'
            ),
        )

        return url_maps
