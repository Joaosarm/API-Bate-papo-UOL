import chalk from "chalk";
import express, {json} from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

const app = express();
app.use(express.json());
app.use(cors());
app.use(json());

dotenv.config();


app.post('/participants', async (req, res) =>{
    const {name} = req.body;
    const user = {
        name,
        lastStatus: Date.now()
    };

    const userSchema = joi.object({
        name: joi.string().required(),
        lastStatus: joi.number().required()
    });

    const validation = userSchema.validate(user);

    if(validation.error){
        res.sendStatus(422);
        return;
    }

    try{
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);

        const participants = await database.collection('participants').find({name: name}).toArray();
        if(participants.length>0){ 
            res.sendStatus(409);
            await mongoClient.close();
            return; 
        }

        const message = {
            from: name,
            to:'Todos',
            text: 'entra na sala...',
            type:'status',
            time: dayjs().format('HH:mm:ss')
        };

        await database.collection('participants').insertOne(user);
        await database.collection('messages').insertOne(message);


        res.sendStatus(201);

        await mongoClient.close();
    } catch (e){
        console.log(chalk.red.bold('Erro ao enviar dados do participante!'), e);
        await mongoClient.close();
    }
})

app.get('/participants', async (req,res)=>{
    try{
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);

        const participants = await database.collection("participants").find({}).toArray();
        res.send(participants);

        mongoClient.close();
    } catch(e) {
        console.log(chalk.red.bold('Erro ao receber dados dos participantes!'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.post("/messages", async (req,res) =>{
    const {to, text, type} = req.body;
    const {user: from} = req.headers;

    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.required().valid("message", "private_message"),
        time: joi.required()
    });

    try{
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);

        const user = await database.collection('participants').findOne({name: from});

        const time = await dayjs().format('HH:mm:ss');

        const message = {
            from: user.name,
            to,
            text,
            type,
            time
        };

        const validation = messageSchema.validate(message);

        if(validation.error){
            res.sendStatus(422);
            return;
        }

        await database.collection('messages').insertOne(message);
        res.sendStatus(201);

        mongoClient.close();
    } catch (e){
         console.log(chalk.red.bold('Erro ao enviar dados da mensagem!'), e);
         res.sendStatus(500);
         mongoClient.close();
    }
})

app.get("/messages", async (req,res) =>{
    const {user: user} = req.headers;
    const limit = parseInt(req.query.limit);

    try{
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);

        const messages = await database.collection('messages').find({}).toArray();

        let userMessages = [];
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].to === user || messages[i].to === "Todos") {
                userMessages.push(messages[i]);
            }
        }

        if(limit){
            const filteredMessages = [...userMessages].slice(userMessages.length - 2 - limit , userMessages.length);
            res.status(201).send(filteredMessages);
        } else{
            res.status(201).send(userMessages);
        }

        mongoClient.close();
    } catch (e){
         console.log(chalk.red.bold('Erro ao receber mensagens!'), e);
         res.sendStatus(500);
         mongoClient.close();
    }
})

app.post("/status", async (req,res) =>{
    const {user: name} = req.headers;

    try{
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);


        const isThere = await database.collection('participants').findOne({name});

        if(!isThere){
            res.sendStatus(404);
            mongoClient.close();
            return;
        }

        await database.collection('participants').updateOne({name}, {$set: {lastStatus: Date.now()}});

        res.sendStatus(200);

        mongoClient.close();

    } catch (e){
        console.log(chalk.red.bold('Erro ao atualizar status!'), e);
        res.sendStatus(500);
        mongoClient.close();
   }
    
})

setInterval(onlineParticipants, 15000);

async function onlineParticipants() {
    try {
        const mongoClient = new MongoClient(process.env.MONGO_URL);
        await mongoClient.connect();
        const database = mongoClient.db(process.env.MONGO_DATABASE);

        const participants = database.collection("participants");
        const messages = database.collection("messages");
        const now = Date.now();
        const unactiveParticipants = await participants.find({ 
            lastStatus: { $lt: now - 10000 } 
        }).toArray();
    
        if(unactiveParticipants.length>0){
            await participants.deleteMany({
                lastStatus: { $lt: now - 10000 },
            });
        
            unactiveParticipants.forEach((participant) => {
                messages.insertOne({
                from: participant.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss"),
                });
            });
        }
    } catch (e){
        console.log(chalk.red.bold('Erro ao apagar participantes!'), e);
    }
  }

app.listen(process.env.PORTA, console.log(chalk.blue.bold("Servidor Funcionando!")));