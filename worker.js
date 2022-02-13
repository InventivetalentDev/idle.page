addEventListener("fetch", (event) => {
    event.respondWith(
        handleRequest(event.request).catch(
            (err) => new Response(err.stack, {status: 500})
        )
    );
});

const ONE_MONTH = 60 * 60 * 24 * 30;

/**
 * Many more examples available at:
 *   https://developers.cloudflare.com/workers/examples
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
    const {pathname} = new URL(request.url);

    const allowedOrigin = "https://idle.page";

    if (request.method === "OPTIONS") {
        return new Response("", {
            headers: {
                "Access-Control-Allow-Origin": allowedOrigin,
            }
        })
    }

    const headers = {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=59"
    }

    if (request.method === "GET" && pathname.startsWith("/api/new")) {
        const id = (Math.random() + 1).toString(36).substring(2);
        const key = crypto.randomUUID().replace(/-/g, '');
        const secret = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
        const data = {n: id, k: key};
        await IDLEPAGE.put("data:" + id + ":" + key, JSON.stringify({t: 0, l: (Math.floor(Date.now() / 1000)), s: secret}), {expirationTtl: ONE_MONTH, metadata: {t: 0}});
        return new Response(JSON.stringify(data), {
            headers: Object.assign({}, headers, {
                "Set-Cookie": "page=" + secret + "; Domain=idle.page; Path=/; Max-Age=" + ONE_MONTH + "; Secure; HttpOnly; SameSite=Strict"
            })

        });
    }

    if (request.method === "GET" && pathname.startsWith("/api/leaderboard")) {
        const data = await IDLEPAGE.get("leaderboard");
        return new Response(data, {
            headers: Object.assign({}, headers, {
                "Cache-Control": "public, max-age=3600"
            })
        });
    }

    if (request.method === "POST" && pathname.startsWith("/api/tick/")) {
        const now = Math.floor(Date.now() / 1000);
        const split = pathname.split("/");
        console.log(split);
        const id = split[3];
        const k = split[4];
        const key = "data:" + id + ":" + k;
        let rawdata = await IDLEPAGE.get(key);
        if (rawdata === null) {
            return new Response(JSON.stringify({e: 1, msg: "invalid"}), {
                status: 400,
                headers: headers
            });
        }
        const data = JSON.parse(rawdata);
        const cookie = getCookie(request.headers.get("cookie"), 'page');
        if (cookie !== data.s) {
            return new Response(JSON.stringify({e: 3, msg: "invalid session"}), {
                status: 403,
                headers: headers
            });
        }
        if (now - data.l < 60) {
            return new Response(JSON.stringify({e: 9, msg: "too soon"}), {
                status: 429,
                headers: headers
            });
        }

        data.t += 1;
        data.l = now;
        await IDLEPAGE.put(key, JSON.stringify(data), {expirationTtl: ONE_MONTH, metadata: {t: data.t}});
        const secret = data.s;
        delete data.s;

        return new Response(JSON.stringify(data), {
            headers: Object.assign({}, headers, {
                "Set-Cookie": "page=" + secret + "; Domain=idle.page; Path=/; Max-Age=" + ONE_MONTH + "; Secure; HttpOnly; SameSite=Strict"
            })
        });
    }

    return new Response(JSON.stringify({e: 4, msg: "not found"}), {
        status: 404,
        headers: headers
    });
}


function getCookie(cookies, name) {
    const value = `; ${ cookies }`;
    const parts = value.split(`; ${ name }=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}


addEventListener('scheduled', event => {
    event.waitUntil(triggerEvent(event.scheduledTime))
})

async function triggerEvent(scheduledTime) {
    console.log("processing cron...");
    console.log(scheduledTime)
    const start = Date.now();

    const list = [];
    let value = await IDLEPAGE.list({prefix: "data:"});
    value.keys
        .filter(k => {
            return typeof k.metadata !== "undefined" && k.metadata.t > 1
        })
        .forEach(k => list.push(k));
    while (!value.list_complete && typeof value.cursor !== "undefined") {
        value = await IDLEPAGE.list({prefix: "data:", cursor: value.cursor});
        value.keys
            .filter(k => {
                return typeof k.metadata !== "undefined" && k.metadata.t > 1
            })
            .forEach(k => list.push(k));
    }
    list.sort((a, b) => {
        return b.metadata.t - a.metadata.t;
    });
    console.log(list)

    let promises = [];
    for (let i = 0; i < Math.min(100, list.length); i++) {
        const k = list[i].name;
        promises.push(IDLEPAGE.get(k).then(v => {
            let j = JSON.parse(v);
            j.k = k;
            return j;
        }));
    }
    const values = await Promise.all(promises);
    console.log(values)
    const filtered = [];
    for (let v of values) {
        let split = v.k.split(":");
        filtered.push({
            n: split[1],
            k: split[2].substring(0, 8),
            t: v.t
        })
    }
    console.log(filtered)

    await IDLEPAGE.put("leaderboard", JSON.stringify(filtered));

    console.log("cron processed")
    console.log(Date.now() - start);
}
