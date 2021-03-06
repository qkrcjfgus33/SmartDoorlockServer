/**
 * @module util/db
 */

"use strict"

import execCacheQuery from './execCacheQuery';

/**
 * 로그인 시도
 * @method login
 * @param  {object}     loginInfo   id와 password를 가진 객체
 * @return {object}                 { result: 성공/실패여부, user:성공시 유저정보객체 반환, 실패시 null }
 */
async function login(loginInfo){
    let columns = ['id', 'name', 'password', 'registDate', 'latestAuthDate', 'doorlockId'];
    let query = `SELECT ${selectQueryHelper(columns)} FROM ${tableNameQueryHelper('user')} ${whereQueryHelper(loginInfo)}`;

    let { rows } = await execCacheQuery(query);
    //console.log(rows.length);
    if (rows.length !== 1){
        return {result: false, user: null};
    }

    return {result: true, user: rows[0]};
}

/**
 * 도어락 고유키, 아이디 체크
 * @method checkDoorlockKey
 * @param  {object}     doorlockInfo    doorlockId, doorlockKey를 가진 객체
 * @return {boolean}                    일치여부
 */
async function checkDoorlockKey(doorlockInfo){
    let columns = ['id'];
    let query = `SELECT ${selectQueryHelper(columns)} FROM ${tableNameQueryHelper('doorlock')} ${whereQueryHelper(doorlockInfo)}`;
    let { rows } = await execCacheQuery(query);
    if (rows.length !== 1){
        return false;
    }

    return true;
}

/**
 * 유저 등록용 함수
 * @method registUser
 * @param  {object}   registInfo    name, doorlockId를 가진 객체
 * @return {object}                 유저 정보객체(id, password, registDate, latestAuthDate, name, doorlockId)
 */
async function registUser(registInfo){
    registInfo.id                = null
    registInfo.GCMRegistrationId = null
    registInfo.password          = makeRandomString(20)
    registInfo.registDate        = Math.floor((+new Date())/1000)
    registInfo.latestAuthDate    = registInfo.registDate
    registInfo.state             = 'registed'

    let query = `INSERT INTO ${tableNameQueryHelper('user')} ${insertQueryHelper(registInfo)}`

    let { rows } = await execCacheQuery(query)

    registInfo.id = rows.insertId

    return registInfo
}

//@TODO 주석작성
async function unregistUser(userId){
    let query = `UPDATE ${tableNameQueryHelper('user')} ${updateQueryHelper({state: 'unregisted'})} ${whereQueryHelper({id: userId})}`;
    return await execCacheQuery(query);
}

function doorlockInfo(){
    return Q();
}

/**
 * 특정 유저의 GCMRegistrationId 데이터 갱신
 * @method setGCMRegistrationId
 * @param  {object}             GCMInfo     userId, GCMRegistrationId를 가진 객체
 */
async function setGCMRegistrationId(GCMInfo){
    let query = `UPDATE ${tableNameQueryHelper('user')} ${updateQueryHelper({GCMRegistrationId: GCMInfo.GCMRegistrationId})} ${whereQueryHelper({id: GCMInfo.userId})}`;
    return await execCacheQuery(query);
}

/**
 * 인증기록 저장
 * @method saveHistory
 * @param  {object}     historyInfo     userId, doorlockId, state, authtime를 가진 객체
 * @return {Promise}                    Promise객체
 */
async function saveHistory(historyInfo){
    let query = `INSERT INTO  ${tableNameQueryHelper('history')} ${insertQueryHelper(Object.assign({}, historyInfo, { id:null }))}`;
    return await execCacheQuery(query);
}

/**
 * 특정 유저의 최종 인증시간 업데이트
 * @method updateLatestAuthDate
 * @param  {int}        id              업데이트될 user id
 * @param  {int}        latestAuthDate  최종 인증시간
 * @return {Promise}                    Promise객체
 */
async function updateLatestAuthDate(id, latestAuthDate){
    let query = `UPDATE ${tableNameQueryHelper('user')} ${updateQueryHelper({latestAuthDate})} ${whereQueryHelper({id})}`;
    return await execCacheQuery(query);
}

/**
 * 특정 doorlockId를 가진 유저의 GCMRegistrationId를 get
 * @method getDoorlockIdOfGCMRegistrationId
 * @param  {int}        doorlockId  특정 doorlock id
 * @return {Promise}                Promise객체
 */
async function getDoorlockIdOfGCMRegistrationId(doorlockId){
    let columns  = ['GCMRegistrationId'];
    let query = `SELECT ${selectQueryHelper(columns)} FROM ${tableNameQueryHelper('user')} ${whereQueryHelper({doorlockId, state: 'registed'})}`;
    let { rows } = await execCacheQuery(query);
    return rows.map((obj)=>{
        return obj.GCMRegistrationId
    });
}

//UPDATE  `doorlock`.`user` SET  `name` =  'test2' WHERE  `user`.`id` =98;
//@TODO 주석작성
async function changeName(id, name){
    let query = `UPDATE ${tableNameQueryHelper('user')} ${updateQueryHelper({name})} ${whereQueryHelper({id})}`;
    return await execCacheQuery(query);
}

//SELECT `id`,`name`,`registDate`,`latestAuthDate` FROM `user` WHERE `doorlockId` = 2
//@TODO 주석작성
async function getUsers(doorlockId){
    let columns  = ['id', 'name', 'registDate', 'latestAuthDate'];
    let query    = `SELECT ${selectQueryHelper(columns)} FROM ${tableNameQueryHelper('user')} ${whereQueryHelper({doorlockId})}`;
    let { rows } = await execCacheQuery(query);
    return rows.map((obj)=>{
        return obj
    });
}

//@TODO 주석작성
async function getHistory(doorlockId){
    let query = `SELECT history.*, user.name From ${tableNameQueryHelper('history')} LEFT JOIN ${tableNameQueryHelper('user')} ON \`history\`.\`userId\` = \`user\`.\`id\` WHERE \`history\`.\`doorlockId\` = '${doorlockId}' ORDER BY  \`history\`.\`authtime\` ASC`
    console.log(query);
    let { rows } = await execCacheQuery(query);
    return rows.map((obj)=>{
        return obj
    });
}

//@TODO 주석작성
//SELECT * FROM  `history` WHERE `userId` =98 AND `authtime` >100 AND `state` = 'success'
async function getHistoryFilter(doorlockId, filter){
    let query = `SELECT history.*, user.name From ${tableNameQueryHelper('history')} LEFT JOIN ${tableNameQueryHelper('user')} ON \`history\`.\`userId\` = \`user\`.\`id\` WHERE \`history\`.\`doorlockId\` = '${doorlockId}'`

    if(filter.userID > 0){
        query += ` AND \`history\`.\`userId\` = '${filter.userID}'`;
    }

    query += ` AND \`history\`.\`authtime\` >= ${filter.startDate}`;

    query += ` AND \`history\`.\`authtime\` <= ${filter.endDate}`;

    if(filter.searchState !== false){
        query += ` AND \`history\`.\`state\` = '${filter.searchState}'`;
    }
    query += ` ORDER BY  \`history\`.\`authtime\` ASC`;

    let { rows } = await execCacheQuery(query);
    console.log(query)
    return rows.map((obj)=>{
        return obj
    });
}

/**
 * 랜덤문자열 생성
 * @method makeRandomString
 * @param  {int}            size 문자열 길이
 * @return {String}              생성된 랜덤문자열
 */
function makeRandomString(size){
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( let i=0; i < size; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

/**
 * where 쿼리 제작 헬퍼
 * @method whereQueryHelper
 * @param  {Object}           obj
 * @return {String}
 */
function whereQueryHelper(obj){
    let query = [];
    for(let key in obj){
        let val = obj[key];
        if(val === null || val === undefined){
            val = `NULL`;
        }else{
            val = `'${obj[key]}'`;
        }

        query.push(`\`${key}\` = ${val}`);
    }
    return 'WHERE ' + query.join(' AND ');
}

/**
 * insert 쿼리 헬퍼
 * @method insertQueryHelper
 * @param  {Object}           obj
 * @return {String}
 */
function insertQueryHelper(obj){
    let keys = [];
    let vals = [];
    for(let key in obj){
        let val = obj[key];
        keys.push(`\`${key}\``);
        if(val === null || val === undefined){
            vals.push(`NULL`);
        }else{
            vals.push(`'${val}'`);
        }
    }
    return `(${keys.join(', ')}) VALUES (${vals.join(', ')})`;
}

/**
 * update 쿼리 헬퍼
 * @method updateQueryHelper
 * @param  {Object}           obj
 * @return {String}
 */
function updateQueryHelper(obj){
    let query = [];
    for(let key in obj){
        let val = obj[key];
        if(val === null || val === undefined){
            val = `NULL`;
        }else{
            val = `'${obj[key]}'`;
        }

        query.push(`\`${key}\` = ${val}`);
    }
    return 'SET ' + query.join(', ');
}

/**
 * select 쿼리 헬퍼
 * @method selectQueryHelper
 * @param  {Array}           arr
 * @return {String}
 */
function selectQueryHelper(arr){
    return arr.map((val)=> `\`${val}\``).join(', ');
}

/**
 * 테이블명 쿼리 헬퍼
 * @method tableNameQueryHelper
 * @param  {String}           tableName
 * @return {String}
 */
function tableNameQueryHelper(tableName){
    return `\`doorlock\`.\`${tableName}\``;
}

export default {
    login,
    checkDoorlockKey,
    registUser,
    unregistUser,
    doorlockInfo,
    setGCMRegistrationId,
    saveHistory,
    updateLatestAuthDate,
    getDoorlockIdOfGCMRegistrationId,
    changeName,
    getUsers,
    getHistory,
    getHistoryFilter,
}
