function registerLeadRoutes(router, { leadController, requireRoutePermission }) {
    // Leads & Timeline
    router.get('/leads', leadController.getLeads);
    router.post('/leads', leadController.addLead);
    router.get('/leads/export.csv', leadController.exportLeadsCsv);
    router.post('/leads/email-export', requireRoutePermission('viewLeads'), leadController.emailExportLeads);
    router.post('/leads/import', leadController.importLeadsCsv);
    router.post('/leads/update/:id', leadController.updateLead);
    router.post('/leads/assign-bulk', leadController.bulkAssignLeads);
    router.post('/leads/request-inactive/:id', leadController.requestLeadInactive);
    router.post('/leads/delete/:id', leadController.deleteLead);
    router.post('/leads/reject-inactive/:id', leadController.rejectLeadInactiveRequest);
    router.post('/leads/restore/:id', leadController.restoreLead);
    router.post('/leads/activity', requireRoutePermission('updateLead'), leadController.addTimelineActivity);
}

module.exports = {
    registerLeadRoutes
};