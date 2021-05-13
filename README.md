# codio-api-js
```
import codio from 'codio-api-js

codio.setDomain('codio.com') // codio.co.uk for UK domain, codio.com is default
```

## Authentication
```
const token = await codio.auth(client_id, client_secret)
```

## Publish Assignment
```
  await codio.assignment.publish(courseId, assignmentId, projectPath, changelog)

  await codio.assignment.publishArchive(courseId, assignmentId, projectArchivePath, changelog)

```

## Reduce (ex Books)
truncate pages from project
```
  await codio.tools.reduce(srcDir, dstDir, sections, paths)
```

## Reduce Publish
Call reduce and publish according to yaml configuration files
```
  await codio.assignment.reducePublish(courseId, srcDir, yamConfigsDir, changelog)
```
