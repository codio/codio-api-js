import https from 'https'
import fs from 'fs'
import path from 'path'

import codio from '../index'

const client_id = ''
const secret_id = ''

const courseId = ''
const assignmentId = ''
const folder = `${assignmentId}`


async function downloadFile(link: string, dest: string): Promise<void> {
    const file = fs.createWriteStream(dest)
    return new Promise((resolve, reject) => {
        https.get(link, (response) => {
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
        }).on('error', (err) => {
            fs.unlink(dest, e => {
                reject(e && e.message)
            })
            reject(err.message)
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
        await Promise.all(links.map(link => {
            const parsed = path.parse(link)
            const dest = `${folder}/${parsed.name}${parsed.ext}`
            return downloadFile(link, dest)
                .then(() => console.log('downloaded', link))
        }))
    } catch (error) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()
