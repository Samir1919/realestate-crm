function registerLeadApiRoutes(router, { leadController, requireRoutePermission }) {
    router.get('/api/leads', requireRoutePermission('viewLeads'), leadController.getLeadsApi);
    router.get('/api/leads/version', requireRoutePermission('viewLeads'), leadController.getLeadsVersion);
}

module.exports = {
    registerLeadApiRoutes
};