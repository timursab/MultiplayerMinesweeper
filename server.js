const express = require('express')
const app = express()
const server = require('http').createServer()
const WebSocket = require('ws')

const wss = new WebSocket.Server({server})
const rooms = {}

function connectionExists(value) {
    for (const room in rooms) {
        for (const obj of rooms[room].clients) {
            if (obj.clientId === value) {
              return true
            }
          }
    }
    return false
}

function findRoomFromId(id){
    for (const room in rooms) {
        for (const con of rooms[room].clients) {
            if (con.clientId === id) {
                console.log('client found'+con.userName)
                return rooms[room]
            }
        }
    }
    return null
}

function removeClientFromRoom(value) {
    for (const room in rooms) {
        for (const client of rooms[room].clients) {
            if (client.clientId === value) {
                const index = rooms[room].clients.indexOf(client)
                rooms[room].clients.splice(index,1)
                if(rooms[room].clients.length <= 0){
                    delete rooms[room]
                }
                return client.userName
            }
        }
    }
}

wss.on('connection',(ws)=>{
    console.log('New connection')
    try{
        ws.on('message',(message)=>{
            const data = JSON.parse(message.toString())
            if(data.method === 'create'){
                //Should check if client is already in a lobby
                if(connectionExists(ws.clientId)) return;

                ws.userName=data.userName
                const roomId = guid()
                rooms[roomId]={
                    clients:[ws],
                    mines:[]
                }
                ws.send(JSON.stringify({
                    'method':'create',
                    'roomId':roomId
                }))
                console.log(rooms[roomId])
            }
            if(data.method === 'join'){
                //Should check if client is already in a lobby
                if(rooms[data.roomId]===undefined) return;
                if(connectionExists(ws.clientId)) return;
                console.log(data.userName)
                ws.userName=data.userName
                rooms[data.roomId].clients.push(ws)
                console.log(rooms)

                //Create an array of userNames to send to the new connected client
                let userNames = []
                rooms[data.roomId].clients.forEach(c=>{
                    userNames.push(c.userName)
                })
                ws.send(JSON.stringify({
                    'method':'join',
                    'roomId':data.roomId,
                    'mines':rooms[data.roomId].mines,
                    'userNames':userNames
                }))
                //Send userName to all clients except the current one in that lobby
                rooms[data.roomId].clients.forEach(c => {
                    if(c==ws) return
                    c.send(JSON.stringify({
                        'method':'newPlayer',
                        'userName':data.userName
                    }))
                })
            }
            if(data.method === 'put'){
                //Should check if client is already in a lobby
                rooms[data.roomId].mines[data.mine] = !rooms[data.roomId].mines[data.mine]
                console.log(rooms)
                rooms[data.roomId].clients.forEach(c => {
                    c.send(JSON.stringify({
                        'method':'put',
                        'mines':rooms[data.roomId].mines
                    }))
                })
            }
            if(data.method === 'leave'){
                const room = findRoomFromId(ws.clientId)
                //Only if client was in a lobby
                if(room === null) return;

                const removedUserName = removeClientFromRoom(ws.clientId)
                ws.send(JSON.stringify({
                    'method':'leave',
                }))
                room.clients.forEach(c => {
                    if(c==ws) return
                    c.send(JSON.stringify({
                        'method':'removeUser',
                        'userName':removedUserName
                    }))
                })
            }
            

        })
        ws.on('close',()=>{
            const room = findRoomFromId(ws.clientId)
            //Only if client was in a lobby
            if(room === null) return;
            const removedUserName = removeClientFromRoom(ws.clientId)
            room.clients.forEach(c => {
                if(c==ws) return
                c.send(JSON.stringify({
                    'method':'removeUser',
                    'userName':removedUserName
                }))
            })
        })

    }
    catch(err){
        console.log(err)
    }

    //Create an id for this connection
    ws.clientId = guid()
    ws.send(JSON.stringify({
        'method':'open',
        'clientId':ws.clientId
    }))
})

app.use(express.static('public'))

const guid=()=> {
    const s4=()=> Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);    
    return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`
}


//Express and Ws on the same port/server
server.on('request',app)

server.listen(3000,()=>{console.log('Listening on port: 3000')})