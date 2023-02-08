const express = require('express')
const app = express()
const server = require('http').createServer()
const WebSocket = require('ws')

const wss = new WebSocket.Server({server})
const rooms = {}
const PORT = process.env.PORT || 3000
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

function createMines(){
    let mines = []
    //Create the board (2d array)with all squares set to 0
    for (let y = 0; y < 10; y++) {
        mines[y]=[]
        for (let x = 0; x < 10; x++) {
            mines[y][x] = 0;
        }
    }
    //Position the mines randomly
    for(let i = 0; i < 15; i++){
        const y = Math.floor(Math.random()*10)
        const x = Math.floor(Math.random()*10)
        mines[y][x] = 'X'
    }
    //Set mine count
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            if(mines[y][x]==='X') continue
            let count = 0
            if(mines[y][x+1]==='X') count++ //Right
            if(mines[y][x-1]==='X') count++ //Left
            if(y !== 0 && mines[y-1][x]==='X') count++ //Top
            if(y !== 9 && mines[y+1][x]==='X') count++ //Bottom
            if(y !== 0 && mines[y-1][x-1]==='X') count++ //TopLeft
            if(y !== 0 && mines[y-1][x+1]==='X') count++ //TopRight
            if(y !== 9 && mines[y+1][x-1]==='X') count++ //BottomLeft
            if(y !== 9 && mines[y+1][x+1]==='X') count++ //BottomRight

            mines[y][x]=count
        }
    }
    return mines
}

function openTiles(y,x,prevzero,state,board){
    if(!state[y][x+1]&&(board[y][x+1]===0||prevzero)&&x !== 9){
        const onZero = board[y][x+1]===0
        setTimeout(() => {
            if(onZero){
                openTiles(y,x+1,true,state,board)
            }
            else{
                openTiles(y,x+1,false,state,board)
            }
        }, 100 ,onZero);
        state[y][x+1]=true

    }//Right
    if(!state[y][x-1]&&(board[y][x-1]===0||prevzero)&&x !== 0){
        const onZero = board[y][x-1]===0
        setTimeout(() => {
            if(onZero){
                openTiles(y,x-1,true,state,board)
            }
            else{
                openTiles(y,x-1,false,state,board)
            }
        }, 100 ,onZero);
        state[y][x-1]=true

    }//Left
    //if(y<=0||y>=9)return
    if(y !== 0){
        if(!state[y-1][x]&&(board[y-1][x]===0||prevzero)){
        const onZero = board[y-1][x]===0
        setTimeout(() => {
            if(onZero){
                openTiles(y-1,x,true,state,board)
            }
            else{
                openTiles(y-1,x,false,state,board)
            }
        }, 100 ,onZero);
        state[y-1][x]=true

    }//Up
    }
    if(y !== 9){
    if(!state[y+1][x]&&(board[y+1][x]===0||prevzero)){
        const onZero = board[y+1][x]===0
        setTimeout(() => {
            if(onZero){
                openTiles(y+1,x,true,state,board)
            }
            else{
                openTiles(y+1,x,false,state,board)
            }
        }, 100 ,onZero);
        state[y+1][x]=true

    }//Down
    }
}
function createMineState(){
    let mineState = []
    for(let y=0;y<10;y++){
        mineState[y]=[]
        for(let x=0;x<10;x++){
            mineState[y][x]=false
        }
    }
    return mineState;
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
                    mines:createMines(),
                    mineState:createMineState()
                }
                ws.send(JSON.stringify({
                    'method':'create',
                    'roomId':roomId,
                    'mines':rooms[roomId].mines
                }))
                console.log(rooms[roomId].mines)
            }
            if(data.method === 'join'){
                //Should check if client is already in a lobby
                if(rooms[data.roomId]===undefined) return;
                if(connectionExists(ws.clientId)) return;
                console.log(data.userName)
                ws.userName=data.userName
                rooms[data.roomId].clients.push(ws)

                //Create an array of userNames to send to the new connected client
                let userNames = []
                rooms[data.roomId].clients.forEach(c=>{
                    userNames.push(c.userName)
                })
                ws.send(JSON.stringify({
                    'method':'join',
                    'roomId':data.roomId,
                    'mines':rooms[data.roomId].mines,
                    'userNames':userNames,
                    'mineState':rooms[data.roomId].mineState
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
                openTiles(data.mine.y,data.mine.x,false,rooms[data.roomId].mineState,rooms[data.roomId].mines)

                if(rooms[data.roomId].mines[data.mine.y][data.mine.x] === 'X'){

                    rooms[data.roomId].mines = createMines()
                    rooms[data.roomId].mineState = createMineState()

                    rooms[data.roomId].clients.forEach(c => {
                        c.send(JSON.stringify({
                            'method':'lost',
                            'mines':rooms[data.roomId].mines
                        }))
                    })
                    return
                }
                rooms[data.roomId].mineState[data.mine.y][data.mine.x] = true
                rooms[data.roomId].clients.forEach(c => {
                    if(c==ws)return;
                    c.send(JSON.stringify({
                        'method':'put',
                        'changedMine':{y:data.mine.y,x:data.mine.x}
                    }))
                })
                console.log(rooms[data.roomId].mineState)
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

server.listen(PORT,()=>{console.log('Listening on port: '+PORT)})