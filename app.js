const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db;

const intializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at PORT 3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

intializeDBAndServer();

//middleware
const authenticationToken = (req, res, next) => {
  let jwtTok;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtTok = authHeader.split(" ")[1];
  }
  if (jwtTok === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtTok, "secretekey", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelCaseKey] = obj[key];
  }
  return newObj;
};

const convertArrayToCamelCase = (array) => {
  return array.map((item) => toCamelCase(item));
};

//api 1
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const getUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;

  const userDetails = await db.get(getUserQuery);

  if (userDetails === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const verifyPW = await bcrypt.compare(password, userDetails.password);
    if (verifyPW === false) {
      res.status(400);
      res.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretekey");
      res.send({ jwtToken });
    }
  }
});

//api 2
app.get("/states", authenticationToken, async (req, res) => {
  const stateListQuery = `
    SELECT * FROM state;`;

  const stateList = await db.all(stateListQuery);
  res.send(convertArrayToCamelCase(stateList));
});

//api 3
app.get("/states/:stateId/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const stateQuery = `
    SELECT * FROM state where state_id=${stateId};`;

  const stateList = await db.get(stateQuery);
  res.send(toCamelCase(stateList));
});

//api 4
app.post("/districts", authenticationToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const putQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  await db.run(putQuery);
  res.send("District Successfully Added");
});

//api 5
app.get("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const districtQuery = `
    SELECT * FROM district where district_id=${districtId};`;

  const districtList = await db.get(districtQuery);
  res.send(toCamelCase(districtList));
});

//api 6
app.delete("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const districtQuery = `
    DELETE FROM district where district_id=${districtId};`;

  await db.run(districtQuery);
  res.send("District Removed");
});

//api 7
app.put("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const updateQuery = `
    UPDATE district
    SET
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    WHERE district_id=${districtId};`;

  await db.run(updateQuery);
  res.send("District Details Updated");
});

//api 8
app.get("/states/:stateId/stats/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const statsQuery = `
    SELECT 
        sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths
    FROM state join district on state.state_id=district.state_id
    WHERE district.state_id=${stateId};`;

  const statsRes = await db.get(statsQuery);
  res.send(statsRes);
});

module.exports = app;
