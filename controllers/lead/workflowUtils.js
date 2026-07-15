const mongoose = require('mongoose');
const User = require('../../models/User');
const { normalizeOptionalText } = require('./queryUtils');

async function resolveBulkAssignedUser(assignedUserRaw) {
    if (!assignedUserRaw) {
        return {
            success: true,
            assignedUser: null
        };
    }

    if (!mongoose.Types.ObjectId.isValid(assignedUserRaw)) {
        return {
            success: false,
            statusCode: 400,
            message: 'Assigned user সঠিক নয়।'
        };
    }

    const userExists = await User.exists({ _id: assignedUserRaw });
    if (!userExists) {
        return {
            success: false,
            statusCode: 400,
            message: 'Assigned user পাওয়া যায়নি।'
        };
    }

    return {
        success: true,
        assignedUser: assignedUserRaw
    };
}

function buildPendingInactiveRequestPayload({ requestNote, currentUserId, currentUserName }) {
    return {
        status: 'pending',
        note: normalizeOptionalText(requestNote),
        requestedBy: currentUserId,
        requestedByName: currentUserName,
        requestedAt: new Date(),
        reviewedBy: null,
        reviewedByName: undefined,
        reviewedAt: null,
        reviewNote: undefined
    };
}

function buildApprovedInactiveRequestPayload({ lead, reviewNote, currentUserId, currentUserName }) {
    return {
        ...lead.inactiveRequest.toObject(),
        status: 'approved',
        reviewedBy: currentUserId,
        reviewedByName: currentUserName,
        reviewedAt: new Date(),
        reviewNote: normalizeOptionalText(reviewNote) || lead.inactiveRequest.reviewNote
    };
}

function buildRejectedInactiveRequestSet({ reviewNote, currentUserId, currentUserName }) {
    return {
        'inactiveRequest.status': 'rejected',
        'inactiveRequest.reviewedBy': currentUserId,
        'inactiveRequest.reviewedByName': currentUserName,
        'inactiveRequest.reviewedAt': new Date(),
        'inactiveRequest.reviewNote': normalizeOptionalText(reviewNote)
    };
}

module.exports = {
    resolveBulkAssignedUser,
    buildPendingInactiveRequestPayload,
    buildApprovedInactiveRequestPayload,
    buildRejectedInactiveRequestSet
};
