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

To download student's project
you need to specify `course Id : string`, `assignmentId: string`, `studentId: string`

```
  await codio.v1.course.downloadStudentAssignment(courseId, assignmentId, studentId)
```
returns `archive url` string


Get students projects completed last day.
you need to specify `course Id : string`, `assignmentId: string`, `filterFunc: function`

`filterFunc` is functio to filter students by studentProgress

```
filterFunc: (sp: studentProgress) => boolean
```

```
  const date = new Date()
  date.setDate(date.getDate()-1)
  date.setHours(0, 0, 0, 0)
  await codio.v1.course.downloadStudentsAssignments(
    courseId,
    assignmentId,
    studentProgress => studentProgress.completion_date && studentProgress.completion_date > date
  )
```
