# codio-api-js
```
import codio from 'codio-api-js

codio.v1.setDomain('codio.com') // codio.co.uk for UK domain, codio.com is default
```

Follow https://docs.codio.com/develop/develop/ide/tools/ghapi.html#api-integration-information to generate
API keys.

## Authentication
```
const token = await codio.v1.auth(client_id, client_secret)
```

The token is saved inside the library all consequence calls will be made using the token.


## Publish Assignment
This methods allow to publish the assignment either as archive (zip and tar.gz is supported)
you need to specify `course Id : string`, `assignmentId: string`, `changelog: string` and path to either project folder or archive
```
  await codio.v1.assignment.publish(courseId, assignmentId, projectPath, changelog)

  await codio.v1.assignment.publishArchive(courseId, assignmentId, projectArchivePath, changelog)

```

Github Action: https://github.com/codio/codio-assignment-publish-action
Github Action Usage Example: https://github.com/ksimuk/codio-test-publish/blob/master/.github/workflows/publish.yaml

## Reduce (ex Books)
Truncates pages from project. This method creates in the `dstDir` reduced version of the project, 
which contains only pages specified in `sections: string[]` and files specified in `paths: string[]`
```
  await codio.v1.tools.reduce(srcDir, dstDir, sections, paths)
```

## Reduce Publish
Similar to reduce but publishes generated projects as assignments.
```
  await codio.v1.assignment.reducePublish(courseId, srcDir, yamConfigsDir, changelog)
```
`yamlConfig` Directory shoudl contain yaml files in the next format:
`assignment` - id of the assignment to publish
`section` - section name or array of paths to the section
`paths` - an array of files that needs to be exported, `.guides` is exported fully to all assignments

```
- assignment: <assignment Id>
  section:  ["Chapter 1", "Section 1.1"]
  paths: ['Section1.java'] 
  
- assignment: <assignment Id>
  section:  Section 3

```

Github Action: https://github.com/codio/codio-assignment-publish-action
Github Action Usage Example: https://github.com/ksimuk/codio-test-publish-book/tree/master/.github

## Assessment Library

### List Libraries

Returns an array of `Library` items
```
  Library = {
    name: string
    id: string
    createdBy: string
  }

  const libraries = await codio.v1.assessment.listLibraries()
```

### Find Assessments in a library

Retunrs an array of `Assessment` items
```
  const assessments = await codio.v1.assessment.find('libraryId || name', searchTags: Map<string, string>)
```

### Synchronize assessments from library

Publishes all assessments from the project in `project_path` to the library
```
  await codio.v1.assessment.fromCodioProject('libraryId || name', '<project_path>')
```

Please be aware on that this action will update assessment.json with new tags 
needed to keep connection between project assessment and library item. You will 
need to commit the changes to avoid duplication the assessment

Github action: https://github.com/codio/codio-assessments-publish-action

### Get Course Info

#### Course assignments

return 

```
  await codio.v1.course.info(courseId)
```
return `Course` object
```
Course = {
  id: string
  name: string
  assignments: Assignment[] 
}
 Assignment = {
  id: string
  name: string
}
```
#### Course assignments student Progress

```
  await codio.v1.course.assignmentStudentsProgress(courseId, assignmentId)
```
returns `StudentProgress[]` object 
```
StudentProgress = {
  student_id: string
  student_email: string
  seconds_spent: number
  grade: number
  status: string
  completion_date: Date
}
```

Please be aware on that this action will update assessment.json with new tags 
needed to keep connection between project assessment and library item. You will 
need to commit the changes to avoid duplication the assessment

Github action: https://github.com/codio/codio-assessments-publish-action

#### Course assignments students projects

Prepare students's project 
you need to specify `course Id : string`, `assignmentId: string`, `studentId: string`

```
  await codio.v1.course.exportStudentAssignment(courseId, assignmentId, studentId)
```
returns `archive url` string

Or download student's project
you need to specify `course Id : string`, `assignmentId: string`, `studentId: string`

```
  await codio.v1.course.downloadStudentAssignment(courseId, assignmentId, studentId, filePath)
```
downloads file to filePath

#### Export student CSV

Returns url string:
```
await codio.course.exportStudentCSV(courseId, studentId)
```

Download exported student CSV data to filePath:
```
await codio.course.downloadStudentCSV(courseId, studentId, filePath)
```

#### Export assignment CSV

Returns url string:
```
await codio.course.exportAssignmentCSV(courseId, assignmentId)
```

Download exported assignment CSV data to filePath:
```
await codio.course.downloadAssignmentCSV(courseId, assignmentId, filePath)
```

#### Export Assessment Data

Export all assessment results for selected assignments in the course.

The following data is exported to a .csv file for download
(or into a .zip file containing individual csv files if multiple assignments selected).

Returns archive url string:
```
await codio.course.exportAssessmentData(courseId, assignmentIds)
```

To download exported data you need to specify course Id : string, assignmentIds: string (comma-separated list of assignmentIds)
```
await codio.course.downloadAssessmentData(courseId, assignmentIds, filePath)
```
downloads file to filePath

## Publish Stack
This methods allow to publish the stack 
you need to specify 
`stackId : string` - stack to add new published version to,
`id: string | null` - stack id or stack version id to use as base,
`provisioner: string` - one of `ansible` or `bash` to detect which file to use `provision.sh` or `provision.yaml`,
`content: string | null` - content of `provision.yaml` or `provision.sh` file which overrides stored in archive if set (tar.gz is supported),
`archivePath: string | null` - path to archive with files to use during provision,
`message: string` - published version changelog

```
  await codio.v1.stack.publish(
    stackId,
    id,
    provisioner,
    content,
    archivePath,
    message
  )

```

## Get Assignment Settings
`courseId : string` - course id,
`assignmentId : string` - assignment id,

returns `AssignmentSettings` - Settings, missed properties won't be updated
```javascript
  const settings = await codio.assignment.getSettings('<course>', '<assignments>')
```

```javascript
type AssignmentSettings = {
  enableResetAssignmentByStudent?: boolean
  disableDownloadByStudent?: boolean
  visibilityOnDisabled?: string, // "READ_ONLY", "NO_ACCESS",
  visibilityOnCompleted?: string, // "READ_ONLY_RESUBMIT", "READ_ONLY", "NO_ACCESS",
  startTime?: Date | null,
  endTime?: Date | null,
  action?: string // "COMPLETE", "DISABLE", "DISABLE_AND_COMPLETE", 
  penalties?: Penalty[]
}

type Penalty = {
  id: number
  datetime: Date
  percent: number
  message: string
}
```

## Update Assignment Settings
This method allow to update assignment settings.
You need to specify
`courseId : string` - course id,
`assignmentId : string` - assignment id ,
`settings: AssignmentSettings` - Settings, missed properties won't be updated



Example: 
```javascript
  await codio.assignment.updateSettings('<course>', '<assignments>', {
    enableResetAssignmentByStudent: false,
    startTime: null,
    endTime: new Date('2022-05-10T23:59:59+01:00'),
    penalties: [
      {
        id: 1,
        message: "Too Late!",
        percent: 10,
        datetime: new Date('2022-05-09T23:59:59+01:00'),
      }
    ]
  }))
```

### Timezones:

We recommend using [Luxon](https://moment.github.io/luxon/) to deal with time zones.
```javascript
const { DateTime } = require('luxon')

DateTime.fromISO('2022-05-09T23:59:59').toJSDate() // to use local timezone
DateTime.fromISO('2022-05-09T23:59:59', { zone: 'EST' }).toJSDate() // to use other timezone
```
