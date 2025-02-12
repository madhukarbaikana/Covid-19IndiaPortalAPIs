const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializingDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Started At http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error ${error.message}`);
    process.exit(1);
  }
};

initializingDBAndServer();

//Login API
app.post("/login", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
SELECT *
FROM user
WHERE username=?
`;
  const dbUser = await db.get(selectUserQuery, [username]);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secrete_Key");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication to Api
const authenticationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secrete_Key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//GET
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT *
    FROM state
    ORDER BY state_id
    `;
  const dbUser = await db.all(getStatesQuery);

  response.send(
    dbUser.map((eachState) => ({
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    }))
  );
});

//GET
app.get("/states/:stateId", authenticationToken, async (request, response) => {
  const { stateId } = request.params;

  const selectUserQuery = `
    SELECT *
    FROM state
    WHERE state_id= ?
    `;
  const dbUser = await db.get(selectUserQuery, [stateId]);

  response.send({
    stateId: dbUser.state_id,
    stateName: dbUser.state_name,
    population: dbUser.population,
  });
});

//POST
app.post("/districts", authenticationToken, async (request, response) => {
  const districtDetails = request.body;

  const { districtName, stateId, cases, cured, active, deaths } =
    districtDetails;

  const postDistrictQuery = `
INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
VALUES 
    (?,?,?,?,?,?)
`;
  const dbResponse = await db.run(postDistrictQuery, [
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  ]);
  response.send("District Successfully Added");
});

//GET

app.get(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
      SELECT *
      FROM district
      WHERE district_id= ?
      `;
    const district = await db.get(getDistrictQuery, [districtId]);
    response.send({
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    });
  }
);

//Delete

app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id= ?
    `;
    await db.run(deleteDistrictQuery, [districtId]);
    response.send("District Removed");
  }
);

//PUT

app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const { districtName, stateId, cases, cured, active, deaths } =
      districtDetails;
    const putDistrictQuery = `
UPDATE district
SET
    district_name=?,
    state_id=?,
    cases=?,
    cured=?,
    active=?,
    deaths=?
    
WHERE 
    district_id=?
`;
    await db.run(putDistrictQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ]);
    response.send("District Details Updated");
  }
);

//GET
app.get(
  "/states/:stateId/stats",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStateQuery = `
    SELECT SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive, SUM(deaths) as totalDeaths
    FROM district
    WHERE state_id=?
    `;
    const stats = await db.get(getStateQuery, [stateId]);
    response.send(stats);
  }
);

module.exports = app;
