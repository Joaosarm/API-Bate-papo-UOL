import chalk from "chalk";
import express, {json} from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

const app = express();
app.use(express.json());
app.use(cors());
app.use(json());
console.log(dayjs().format('HH:mm:ss'));

dotenv.config();
let database = null;
const mongoClient = new MongoClient(process.env.MONGO_URL);

const promise = mongoClient.connect();

promise.then(() => {
    database = mongoClient.db("batepapoUOL");
    console.log(chalk.green.bold("Banco de dados acessado com sucesso! "));
})

promise.catch(error => console.log(chalk.red.bold('Erro ao acessar bancos de dados!'), error));

app.post('/participants', async (req, res) =>{
    const {name} = req.body;
    
    try{
        await mongoClient.connect();
        database = mongoClient.db("batepapoUOL");

        const participants = await database.collection('participants').find({name: name}).toArray();
        const user = {
            name,
            lastStatus: Date.now()
        };
        if(!name){ //VALIDAR COM BIBLIOTECA JOI
            res.sendStatus(422);
            return;
        }else if(participants.length>0){ 
            res.sendStatus(409);
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

        mongoClient.close();
    } catch (e){
         console.log(chalk.red.bold('Erro ao enviar dados do participante!'), e);
         mongoClient.close();
    }
})

app.get('/participants', async (req,res)=>{
    try{
        await mongoClient.connect();
        database = mongoClient.db("batepapoUOL");

        const participants = await database.collection("participants").find({}).toArray();
        res.send(participants);

        mongoClient.close();
    } catch(e) {
        console.log(chalk.red.bold('Erro ao receber dados do participante!'), e);
        res.sendStatus(500);
        mongoClient.close();
    }
})

app.post("/messages", (req,res) =>{
    const {to, text, type} = req.body;
    const {user: from} = req.headers;

    try{
        await mongoClient.connect();
        database = mongoClient.db("batepapoUOL");

        const user = await database.collection('messages').findOne({name: from}).toArray();

        if(!to||!text||type!=='message'||type!=='private_message'||!user){ //VALIDAR COM BIBLIOTECA JOI
            res.sendStatus(422);
            return;
        }

        const message = {
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        };

        await database.collection('messages').insertOne(message);
        res.sendStatus(201);

        mongoClient.close();
    } catch (e){
         console.log(chalk.red.bold('Erro ao enviar dados da mensagem!'), e);
         res.sendStatus(500);
         mongoClient.close();
    }
})

app.listen(5000, console.log(chalk.blue.bold("Servidor Funcionando!")));