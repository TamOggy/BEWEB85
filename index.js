import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect("mongodb+srv://antam823:XKmdpnJnGxLI00pk@web85.12gw8.mongodb.net/testweb85?retryWrites=true&w=majority&appName=web85", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema and Model
const teacherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    status: { type: String, required: true },
    address: { type: String, required: true },
    // position: { type: String, required: true },
    degrees: [{
        type: {type: String},
        school: {type: String},
        major: {type: String},
         year: {type: Number},
         isGraduated: {type: Boolean}
    }],
     startDate: {type: Date},
    teacherPositionsId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TeacherPosition'}],
    userId: { type: mongoose.Schema.Types.ObjectId, required: true , ref: 'User'},
}, {timestamps: true});
const Teacher = mongoose.model('Teacher', teacherSchema, 'school.teachers');

const teacherPositionSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    des: {type: String},
    isActive: {type: Boolean},
    isDeleted: {type: Boolean}
}, {timestamps: true});
const TeacherPosition = mongoose.model('TeacherPosition', teacherPositionSchema, 'school.teacherpositions');

const userSchema = new mongoose.Schema({
    email: {type: String, required: true},
     address: {type: String},
      dob: {type: Date},
     name: {type: String},
     phoneNumber: {type: String},
       role: {type: String},
      isDeleted: {type: Boolean},
      accountId: {type: String}
}, {timestamps: true});

const User = mongoose.model('User', userSchema, 'school.users');

// Helper function to generate a unique random code
const generateUniqueCode = async () => {
    let code;
    do{
        code = Math.floor(1000000000 + Math.random() * 9000000000);
    } while (await Teacher.exists({code: String(code)}));
    return String(code);
};

// Helper function to validate if the email is unique
const isEmailUnique = async (email) => {
    return !await Teacher.exists({ email });
};

// 1. GET /teachers
app.get('/teachers', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    try {
        const teachers = await Teacher.find()
            .populate('userId')
            .populate('teacherPositionsId')
            .sort({createdAt: 'desc'})
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber)
            .exec(); // Use .lean() to get plain JavaScript objects, not Mongoose documents.
        const total = await Teacher.countDocuments()
        return res.json({teachers, total})

        const formattedTeachers = teachers.map(teacher => ({
            code: teacher.code,
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
            status: teacher.status,
            address: teacher.address,
            position: teacher.position,
            degrees: teacher.degrees,
            startDate: teacher.startDate,
            teacherPositionsId: teacher.teacherPositionsId,
            userId: teacher.userId
        }));
        res.json(formattedTeachers);
    } catch (error) {
        res.status(500).json({message: error.message})
    }
});


// 2. POST /teachers
app.post('/teachers', async (req, res) => {
    const { name, email, phone, status, address, position, degrees, startDate } = req.body;
    if (!name || !email || !phone || !status || !address || !position || !degrees || !startDate) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!await isEmailUnique(email)){
        return res.status(400).json({ message: 'Email is not unique' });
    }
    try {
        const newUser = new User({
            email,
            address,
            name,
            phoneNumber: phone
        })
        const savedUser = await newUser.save()

        const newTeacher = new Teacher({
            code: await generateUniqueCode(),
            name,
            email,
            phone,
            status,
            address,
            teacherPositionsId: position,
            degrees,
            startDate,
            userId: savedUser._id
        });

        const savedTeacher = await newTeacher.save();
        res.status(201).json({
           code: savedTeacher.code,
            name: savedTeacher.name,
            email: savedTeacher.email,
            phone: savedTeacher.phone,
            status: savedTeacher.status,
            address: savedTeacher.address,
            position: savedTeacher.position,
            degrees: savedTeacher.degrees,
            startDate: savedTeacher.startDate,
            userId: savedTeacher.userId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. GET /teacher-positions
app.get('/teacher-positions', async (req, res) => {
    try{
        const positions = await TeacherPosition.find().lean();
         const formattedPositions = positions.map(position => ({
            _id: position._id,
            code: position.code,
             name: position.name,
            des: position.des,
            isActive: position.isActive,
            isDeleted: position.isDeleted
        }))
        res.json(formattedPositions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// 4. POST /teacher-positions
app.post('/teacher-positions', async (req, res) => {
    const { code, name, des, isActive, isDeleted } = req.body;
    if (!code || !name) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        const isCodeUnique = !await TeacherPosition.exists({ code });
        if (!isCodeUnique) {
            return res.status(400).json({ message: 'Code is not unique' });
        }
        const newPosition = new TeacherPosition({code, name, des, isActive, isDeleted});
        const savedPosition = await newPosition.save();
        res.status(201).json({
            code: savedPosition.code,
            name: savedPosition.name,
             des: savedPosition.des,
           isActive: savedPosition.isActive,
            isDeleted: savedPosition.isDeleted
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }

});

// 5. GET /users
app.get('/users', async (req, res) => {
    try{
        const users = await User.find().lean();
        const formattedUsers = users.map(user => ({
            email: user.email,
            address: user.address,
            dob: user.dob,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isDeleted: user.isDeleted,
            accountId: user.accountId
        }))
        res.json(formattedUsers);
    } catch(error){
       res.status(500).json({ message: error.message });
    }
});


// Example of internal API call
app.get('/test-teachers', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8080/teachers?page=1&limit=5', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch(error){
        res.status(500).json({ message: error.message });
    }
});

// Example of calling your own POST
app.post('/test-teacher', async (req, res) => {
  const teacherData = {
        name: "Test Teacher",
        email: "test1@example.com",
        phone: "123-456-7890",
        status: "active",
        address: "Test Address",
        position: "Test Position",
         degrees: [],
         startDate: new Date(),
          teacherPositionsId: [],
           userId: ''
    }
   try {
       const response = await fetch('http://localhost:5000/teachers', {
           method: 'POST',
            headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(teacherData)
       });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
   } catch (error) {
      res.status(500).json({ message: error.message });
   }
});

app.listen(8080, () => {
    console.log(`Server is running on port ${8080}`);
});