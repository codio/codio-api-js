
const courseId = "your course id"
const courseName = "your course name"
const assignmentId = "your assignmentId"
const studentId = "your codio student id"
const studentEmail = "your codio student email"
const studentLogin = "your codio student login"
const libraryId = "your assessment library id"
const libraryName = "your assessment library name" 
const projectPath = "./examples/project"
const stackId = "fb02d280-dfea-4771-9529-e01b7b65b2d5"
const stackVersionId = "d06eada5-f164-4610-82b6-3e9a0c2e5134"
const archivePath = "./examples/project/project.zip"
const yamlMapDir = "./examples/project/.guides/yamlMap"
const courseIdToArchive = "your course id"
const leanersMapping = [
  {
    "mentorId": "mentor2@email",
    "learnerIds": [
      "learner3@email"
    ]
  }
]
const moduleName = "New Module Name"
const courseData = {
  name: "Introduction to Programming",
  description: "This course covers the basics of programming.",
  start: "2025-08-29T09:32:55Z",
  end: "2027-09-25T09:12:00Z",
  timezone: "America/New_York",
  tags: [
    "programming",
    "beginner"
  ]
}
const assignmentData = {
  moduleId: "your module id",
  settings: {
    name: "My First Assignment",
    description: "This assignment covers the basics of programming.",
    gigaboxSlot: {
      boxType: "1gb"
    }
  }
}
const userIdToAdd = "your user id"

module.exports = {
  courseId,
  courseName,
  assignmentId,
  studentId,
  studentEmail,
  studentLogin,
  libraryId,
  libraryName,
  projectPath,
  stackId,
  stackVersionId,
  archivePath,
  yamlMapDir,
  courseIdToArchive,
  leanersMapping,
  moduleName,
  courseData,
  assignmentData,
  userIdToAdd
}
