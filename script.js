const API = "/api";
const container = document.getElementsByClassName("c")[0];
const wrapper = document.getElementsByClassName("t")[0];
const days = document.getElementById("d");
const hours = document.getElementById("h");
const minutes = document.getElementById("m");
const seconds = document.getElementById("s");
const millis = document.getElementById("ms");

let state = {t: 0, l: Math.floor(Date.now() / 1000), s: 0, m: 0, h: 0, d: 0};
let firstTick = true;

async function init() {
    state = Object.assign({}, state, getState());
    if (state == null || !state.l) {
        backupState();
        state = Object.assign({}, state, await createNew());
    }
    console.log(state);
    saveState();

    updateDisplay();

    setTimeout(() => startTicking(), Math.random() * 100);

    container.classList.add("rdy");
}

function getState() {
    const s = localStorage.getItem("page");
    if (s == null || typeof state === "undefined" || s.length < 2) {
        return null;
    }
    return JSON.parse(s);
}

function saveState() {
    localStorage.setItem("page", JSON.stringify(state));
}

function backupState() {
    const date = new Date();
    localStorage.setItem("page__" + date.getFullYear() + "_" + date.getMonth() + "_" + date.getDate() + "__" + Math.round(Math.random() * 500 + Math.random() * 500), localStorage.getItem("page"));
}

function createNew() {
    return fetch(API + "/new/" + Math.floor(Date.now() / 1000 / 60).toString(36), {method: "GET", credentials: "same-origin"})
        .then(res => res.json())
        .then(res => {
            console.log("[new]", res);
            return res;
        })
        .catch(err => {
            console.error("[new]", err);
        })
}

function startTicking() {
    const next = state.l + 60;
    const wait = Math.max(0, next - Math.floor(Date.now() / 1000));
    console.log("waiting " + wait + "s for first tick");
    state.s = 60 - wait;
    setTimeout(() => {
        tick().then(() => {
            setInterval(() => tick(), 1000 * 60 + (Math.random() * 10));
        });
    }, wait * 1000);
    setInterval(() => tickSecond(), 1000);
    setInterval(() => tickMillis(), 12);
}

function tick() {
    return fetch(API + "/tick/" + state.n + "/" + state.k, {method: "POST", credentials: "same-origin"})
        .then(res => res.json())
        .then(res => {
            console.log("[tick]", res);

            if (res.e === 3) { // invalid session
                console.warn("[tick] invalid session");
                setTimeout(() => {
                    window.location.reload();
                }, 100);
                return;
            }


            state = Object.assign({}, state, res);
            updateDisplay();
            saveState();
        })
        .catch(err => {
            console.error("[tick]", err);
        })
}

function tickSecond() {
    state.s = (state.s || 0) + 1;
    if (state.s >= 60) {
        state.s = 0;
        state.t++;
    }

    const oldM = state.m;
    const oldH = state.h;
    const oldD = state.d;

    state.m = state.t % 60;
    state.h = Math.floor(state.t / 60) % 60;
    state.d = Math.floor(state.t / 60 / 24);

    updateDisplay();

    if (!firstTick) { // don't spawn orbs when it's the first update after loading
        if (state.m > oldM) {
            spawnOrb('+1', minutes);
        }
        if (state.h > oldH) {
            spawnOrb('+1', hours);
        }
        if (state.d > oldD) {
            spawnOrb('+1', days);
        }
    }

    firstTick = false;
}

function tickMillis() {
    state.ms = (state.ms || 0) + 12;
    if (state.ms >= 1000) {
        state.ms = 0;
    }
    millis.innerText = pad(`${ state.ms }`, 3);
}

function updateDisplay() {


    if (state.h > 0) {
        wrapper.classList.add("h");
    }
    if (state.d > 0) {
        wrapper.classList.add("d");
    }

    days.innerText = `${ state.d }`;
    hours.innerText = pad(`${ state.h }`, 2);
    minutes.innerText = pad(`${ state.m }`, 2);
    seconds.innerText = pad(`${ state.s }`, 2);
    millis.innerText = pad(`${ state.ms }`, 3);
}

function spawnOrb(content, el) {
    const orb = document.createElement("div");
    orb.innerText = content;
    orb.classList.add("o");
    const left = (el.offsetLeft + el.offsetWidth / 2) + ((Math.random() * el.offsetWidth / 2) - (Math.random() * el.offsetWidth / 2));
    orb.style.top = (el.offsetTop + el.offsetHeight / 4) + 'px';
    orb.style.left = left + 'px';
    orb.classList.add("a");
    document.body.prepend(orb);
    setTimeout(() => {
        document.body.removeChild(orb);
    }, 10000);
}

function pad(s, l) {
    while (s.length < l) {
        s = "0" + s;
    }
    return s;
}

setTimeout(() => init(), Math.random() * 50);