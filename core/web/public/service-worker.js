importScripts(
  "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js",
);
importScripts("firebase-config.js");

firebase.initializeApp(firebaseConfig);

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log("User signed in", user.uid);
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "REDIRECT",
          url: "/",
        });
      });
    });
  } else {
    console.log("User signed out");
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "REDIRECT",
          url: "/login",
        });
      });
    });
  }
});

/**
 * Returns a promise that resolves with an ID token if available.
 * @return {!Promise<?string>} The promise that resolves with an ID token if
 *     available. Otherwise, the promise resolves with null.
 */
const getIdToken = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      unsubscribe();
      if (user) {
        user.getIdToken().then(
          (idToken) => {
            resolve(idToken);
          },
          (error) => {
            resolve(null);
          },
        );
      } else {
        resolve(null);
      }
    });
  }).catch((error) => {
    console.log(error);
  });
};

/**
 * @param {string} url The URL whose origin is to be returned.
 * @return {string} The origin corresponding to given URL.
 */
const getOriginFromUrl = (url) => {
  // https://stackoverflow.com/questions/1420881/how-to-extract-base-url-from-a-string-in-javascript
  const pathArray = url.split("/");
  const protocol = pathArray[0];
  const host = pathArray[2];
  return protocol + "//" + host;
};

self.addEventListener("fetch", (event) => {
  const fetchEvent = event;
  const getBodyContent = (req) => {
    return Promise.resolve()
      .then(() => {
        if (req.method !== "GET") {
          if (req.headers.get("Content-Type").indexOf("json") !== -1) {
            return req.json().then((json) => {
              return JSON.stringify(json);
            });
          } else {
            return req.text();
          }
        }
      })
      .catch((error) => {});
  };

  const requestProcessor = (idToken) => {
    let req = event.request;
    let processRequestPromise = Promise.resolve();
    if (
      self.location.origin == getOriginFromUrl(event.request.url) &&
      (self.location.protocol == "https:" ||
        self.location.hostname == "localhost") &&
      idToken
    ) {
      const headers = new Headers();
      for (let entry of req.headers.entries()) {
        headers.append(entry[0], entry[1]);
      }
      headers.append("Authorization", "Bearer " + idToken);
      processRequestPromise = getBodyContent(req).then((body) => {
        try {
          req = new Request(req.url, {
            method: req.method,
            headers: headers,
            mode: "same-origin",
            credentials: req.credentials,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            body,
            bodyUsed: req.bodyUsed,
            context: req.context,
          });
        } catch (e) {}
      });
    }
    return processRequestPromise
      .then(() => {
        return fetch(req);
      })
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        return response;
      })
      .catch((error) => {
        console.log(error);
      });
  };

  event.respondWith(getIdToken().then(requestProcessor, requestProcessor));
});
