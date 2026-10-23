import { createSpursProxy } from "@spurs-cloud/accounts/next";


export const proxy =  createSpursProxy({
    publicPaths: ['/', 'api/v1']
})

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"], 
}