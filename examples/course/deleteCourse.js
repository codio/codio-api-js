const { codio, auth } = require('../auth.js')

async function main() {
  await auth
  try {
    await codio.course.deleteCourse({id: "your course id", removeOutdatedStudents: false})
    console.log("Course deleted successfully.")
  } catch (error) {
    console.error("Error deleting course:", error)
  }
}

main()
