const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth

    const result = await codio.assignment.updateSettings(courseId, assignmentId, {
    enableResetAssignmentByStudent: true,
    disableDownloadByStudent: true,
    // visibilityOnDisabled: 'NO_ACCESS',
    visibilityOnDisabled: 'READ_ONLY',
    // visibilityOnCompleted: 'NO_ACCESS',
    // visibilityOnCompleted: 'READ_ONLY',
    visibilityOnCompleted: 'READ_ONLY_RESUBMIT',
    // startTime: null,
    startTime: new Date('2024-05-01T13:59:59+01:00'),
    // endTime: null,
    // endTime: new Date('2022-05-20T13:59:59+01:00'),
    endTime: new Date('2025-07-31T13:59:59Z'),
    // action: 'DISABLE',
    // action: 'COMPLETE',
    action: 'DISABLE_AND_COMPLETE'

  })
    console.log(result)

}

main()
