function registerLeadRoutes(router, { leadController, requireLeadPolicy }) {
    // Leads & Timeline
    router.get('/leads', requireLeadPolicy('view'), leadController.getLeads);
    router.post('/leads', requireLeadPolicy('create'), leadController.addLead);
    router.get('/leads/export.csv', requireLeadPolicy('view'), leadController.exportLeadsCsv);
    router.post('/leads/email-export', requireLeadPolicy('view'), leadController.emailExportLeads);
    router.post('/leads/import', requireLeadPolicy('create'), leadController.importLeadsCsv);
    router.post('/leads/update/:id', requireLeadPolicy('update'), leadController.updateLead);
    router.post('/leads/assign-bulk', requireLeadPolicy('update'), leadController.bulkAssignLeads);
    router.post('/leads/request-inactive/:id', requireLeadPolicy('update'), leadController.requestLeadInactive);
    router.post('/leads/delete/:id', requireLeadPolicy('delete'), leadController.deleteLead);
    router.post('/leads/reject-inactive/:id', requireLeadPolicy('delete'), leadController.rejectLeadInactiveRequest);
    router.post('/leads/restore/:id', requireLeadPolicy('delete'), leadController.restoreLead);
    router.post('/leads/activity', requireLeadPolicy('update'), leadController.addTimelineActivity);
}

module.exports = {
    registerLeadRoutes
};