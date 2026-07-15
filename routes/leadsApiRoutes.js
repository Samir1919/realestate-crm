function registerLeadApiRoutes(router, { leadController, requireLeadPolicy }) {
    router.get('/api/leads', requireLeadPolicy('view'), leadController.getLeadsApi);
    router.get('/api/leads/version', requireLeadPolicy('view'), leadController.getLeadsVersion);
}

module.exports = {
    registerLeadApiRoutes
};