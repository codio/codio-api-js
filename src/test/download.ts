import https from 'https'
import fs from 'fs'
import path from 'path'

import codio from '../index'

const client_id = '' // your clientId here
const secret_id = '' // your secretId here

const courseId = '' // your course here
const assignmentId = '' // your assignment here
const folder = `${assignmentId}`


async function downloadFile(link: string, dest: string): Promise<string> {
    const file = fs.createWriteStream(dest)
    return new Promise((resolve, reject) => {
        https.get(link, (response) => {
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve(dest)
            })
        }).on('error', (err) => {
            fs.unlink(dest, e => {
                reject(e && e.message)
            })
            reject(err.message)
        })
    })
}

function removeFile(dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.unlink(dest, err => {
            if (err) {
                reject(err)
            }
            resolve()
        })
    })
}

const main = async () => {
    try {
        codio.v1.setDomain('test2-codio.com')
        await codio.v1.auth(client_id, secret_id)

        const date = new Date()
        date.setDate(date.getDate() - 1)
        date.setUTCHours(0, 0, 0, 0)
        const links = await codio.v1.course.downloadStudentsAssignments(courseId, assignmentId, (studentProgress) => {
            return studentProgress.completion_date > date
        })
        console.log('links', links)
        const filePaths = await Promise.all(links.map(link => {
            const parsed = path.parse(link)
            const dest = `${folder}/${parsed.name}${parsed.ext}`
            return downloadFile(link, dest)
                .then(filePath => {
                    console.log('downloaded', link)
                    return filePath
                })
        }))
        await Promise.all(filePaths.map(path => removeFile(path)))
    } catch (error) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()
