import axios from 'axios'
import pgPromise from 'pg-promise'
import moment from 'moment';

const {
    ORBIT_API_KEY,
    ORBIT_WORKSPACE_ID,
    PGHOST,
    PGUSER,
    PGDATABASE,
    PGPASSWORD,
    PGPORT } = process.env;

const pgp = pgPromise({})
const db = pgp({
    host: PGHOST,
    user: PGUSER,
    database: PGDATABASE,
    password: PGPASSWORD,
    port: PGPORT,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10
});

const getOrbitData = async (start_date, end_date) => {
    const url = `https://app.orbit.love/api/v1/${ORBIT_WORKSPACE_ID}/reports?start_date=${start_date}&end_date=${end_date}`
    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${ORBIT_API_KEY}`,
            'Accept': 'application/json',
        }
    })
    if (response.status === 200) {
        return response.data.data
    } else {
        return undefined
    }
}

const saveToPostgres = async (stat_date, stats) => {

    const postgresData = await verifyPostgresData(stat_date);

    if (postgresData.length !== 0) {
        return;
    }

    const { total_members_count,
        members_on_orbit_level_1_count,
        members_on_orbit_level_2_count,
        members_on_orbit_level_3_count,
        members_on_orbit_level_4_count,
        members_on_orbit_level_none_count } = stats.attributes.overview;

    const {
        active_count,
        new_count,
        returning_count } = stats.attributes.members;


    try {
        const query = {
            text: 'INSERT INTO orbit_stats(stat_date, \
            total_members_count, \
            members_on_orbit_level_1_count, \
            members_on_orbit_level_2_count, \
            members_on_orbit_level_3_count, \
            members_on_orbit_level_4_count, \
            members_on_orbit_level_none_count, \
            active_count, \
            new_count, \
            returning_count \
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            values: [
                stat_date,
                total_members_count,
                members_on_orbit_level_1_count,
                members_on_orbit_level_2_count,
                members_on_orbit_level_3_count,
                members_on_orbit_level_4_count,
                members_on_orbit_level_none_count,
                active_count,
                new_count,
                returning_count],
        }

        await db.none(query)
    }
    catch (error) {
        console.log(error)
    }
}

const verifyPostgresData = async (stat_date) => {
    const query = {
        text: 'SELECT * FROM orbit_stats WHERE stat_date = $1',
        values: [stat_date]
    }

    const data = await db.any(query)
    return data
}

const dt = new moment();

const start_date = new moment(dt).startOf('week').format('YYYY-MM-DD')
const end_date = new moment(start_date).add(6, 'd').format('YYYY-MM-DD')

const stats = await getOrbitData(start_date, end_date);

if (stats) {
    await saveToPostgres(start_date, stats);
    console.log(`Saved stats for ${start_date} - ${end_date}`);
} else {
    console.error(`Error getting stats for ${start_date} - ${end_date}`);
}