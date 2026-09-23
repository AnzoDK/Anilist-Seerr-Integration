// ==UserScript==
// @name        Anilist Seerr Integration Script
// @namespace   Violentmonkey Scripts
// @match       https://anilist.co/*
// @grant GM.xmlHttpRequest 
// @version     0.0.3
// @author      AnzoDK
// @license     MIT
// @description 23/09/2026, 13.21.43
// @downloadURL https://github.com/AnzoDK/Anilist-Toggle-Scores/releases/latest/download/toggle_anilist_scores.js
// @updateURL   https://github.com/AnzoDK/Anilist-Toggle-Scores/releases/latest/download/toggle_anilist_scores.js
// ==/UserScript==

//ENUM

const SEERR_STATUS = 
{
    "UNKNOWN": 1,
    "PENDING": 2,
    "PROCESSING": 3,
    "PARTIALLY_AVAILABLE": 4,
    "AVAILABLE": 5,
    "DELETED": 6,
    "NOT_FOUND": 99 //Not from seerr, but fits here
};

function addBadge(entryNode, status, url)
{

    let badge = document.createElement("div");
    badge.classList.add("seerr-badge");

    let statusA = document.createElement("a");
    statusA.style = "position:absolute;z-index:10000;font-size:15px;background-color:#0b1622;border-radius: 10px 10px 10px 10px;padding:3px;";
    statusA.classList.add("seerr-badge-symbol");
    statusA.href = url;

    switch(status)
    {
        case "UNKNOWN":
            statusA.innerHTML = "❌";
            break;
        case "PENDING":
            statusA.innerHTML = "🔔";
            break;
        case "PROCESSING":
            statusA.innerHTML = "⏳"
            break;
        case "PARTIALLY_AVAILABLE":
            statusA.innerHTML = "◑";
            break;
        case "AVAILABLE":
            statusA.innerHTML = "✅";
            break;
        case "DELETED":
             statusA.innerHTML = "🗑";
             break;
        default:
            statusA.innerHTML = "❓";
            break;
    }


    badge.appendChild(statusA);
    entryNode.appendChild(badge);
}

function intToSeerStatus(num)
{

    for (key in SEERR_STATUS) 
    {
        if (SEERR_STATUS[key] == num) 
        {
            return key;
        }
    }

    switch(num)
    {
        case 1:
            return SEERR_STATUS.UNKNOWN;
        case 2: 
            return SEERR_STATUS.PENDING;
        case 3:
            return SEERR_STATUS.PROCESSING;
        case 4:
            return SEERR_STATUS.PARTIALLY_AVAILABLE;
        case 5:
            return SEERR_STATUS.AVAILABLE;
        case 6:
            return SEERR_STATUS.DELETED;
        default:
            return SEERR_STATUS.NOT_FOUND;
    }
}

//Logger lib
class QLogger
{
    prefix = ""
    constructor(prefix=""){
        this.prefix = prefix;
    }
    LogObject(object)
    {
        console.log(object);
    }
    Info(data)
    {
        this.Log(data)
    }
    Warn(data)
    {
        this.Log(data,"WARN")
    }
    Error(data)
    {
        this.Log(data, "ERR")
    }
    Log(data, level="LOG")
    {
        switch(level)
        {
            case "INFO":
            case "LOG":
                console.log("[" + this.prefix + "] " + data);
            break;
            case "WARN":
                console.warn("[" + this.prefix + "] " + data);
            break;
            case "ERR":
                console.error("[" + this.prefix + "] " + data);
            break;
            default:
                console.warn("[" + this.prefix + "] {UNKNOWN LOGGING LEVEL: " + level + "} " + data);
        }
    }
}

//Seer lib

class LibSeerr
{
    urlBase = "";
    apiVersion = "v1";
    constructor(baseUrl)
    {
        this.urlBase = baseUrl;
    }

    _getApiBase()
    {
        return this.urlBase + "/api/" + this.apiVersion;
    }

    async getSeerrStatus()
    {
        const r = await GM.xmlHttpRequest({ method: "GET", url: this._getApiBase() + "/status", headers: {"Accept": "application/json"} }).catch(e => console.error(e));


        /*const headers = new Headers();

        headers.append("Accept", "application/json");
        //headers.append("Access-Control-Allow-Origin","*");
        //headers.append("Content-Security-Policy", "connect-src " + this.urlBase + "/");

        let response = await fetch(this._getApiBase() + "/status",{method: "GET",redirect: "follow",headers: headers});
        */
        return { "reachable": r.status == 200, "statusCode": r.status };
    }

    async getMedia(pageSize=100000)
    {
        const headers = {
        "Accept": "application/json",
        "Cookie": "connect.sid=%3Cconnect.sid%3E",
        };

        let response = await GM.xmlHttpRequest({ method: "GET", url: this._getApiBase() + "/media?take=" + pageSize, headers: headers});
        return { "reachable": response.status == 200, "statusCode": response.status, data: await response.responseText};
    }

    async lookup(name)
    {
        const headers = {
        "Accept": "application/json",
        "Cookie": "connect.sid=%3Cconnect.sid%3E",
        };

        name = encodeURIComponent(name);

        let response = await GM.xmlHttpRequest({ method: "GET", url: this._getApiBase() + "/search?query=" + name, headers: headers});
        return { "reachable": response.status == 200, "statusCode": response.status, data: await response.responseText};
    }

    makeCall()
    {

    }


}

class StorageManager
{
    keyPrefix = "";

    constructor(keyPrefix="anilist-seerr")
    {
        this.keyPrefix = keyPrefix;
    }

    store(key,val)
    {
        let itemKey = this.keyPrefix+"_"+key;
        if(localStorage.getItem(itemKey) != null)
        {
            throw new Error("store won't allow overwriting - Use Update or Upsert");
        }
        localStorage.setItem(itemKey,val);
    }

    update(key,val)
    {
        let itemKey = this.keyPrefix+"_"+key;
        if(localStorage.getItem(itemKey) == null)
        {
            throw new Error("update won't allow creation - Use store or Upsert");
        }
        localStorage.setItem(itemKey,val);
    }

    upsert(key, val)
    {
        let itemKey = this.keyPrefix+"_"+key;
        localStorage.setItem(itemKey,val);
    }

    get(key)
    {
        return LocalStorage.getItem(itemKey);
    }

}

class SettingsModal
{
    modalActive = false;
    id = "";

    constructor()
    {

    }

    setUp()
    {
        this.setUp_CreateModal();
    }

    setUp_CreateModal()
    {
        var modal = document.createElement("div");
        modal.id = "seerIntegrationModal";
        this.id = modal.id;
        modal.style.position = "fixed";
        modal.style.top = "50%";
        modal.style.left = "50%";
        modal.style.transform = "translate(-50%, -50%)";
        modal.style.backgroundColor = "#182a34";
        modal.style.padding = "20px";
        modal.style.borderRadius = "10px";
        modal.style.display = "none";
        modal.style.zIndex = "1000";
        var title = document.createElement("h2");
        title.appendChild(document.createTextNode("Seerr Integration Settings"));
        title.style.color = "white";
        modal.appendChild(title);

        var label = document.createElement("label");
        label.appendChild(document.createTextNode(":"));
        label.style.color = "white";
        label.innerHTML += "<br><br>";
        modal.appendChild(label);

        var typeList = document.createElement("div");
        typeList.style.display = "grid";
        typeList.style.gridTemplateColumns = "auto auto auto auto auto auto";
        typeList.style.alignItems = "center";
        typeList.style.justifyContent = "center";
        typeList.style.textAlign = "center";
        label.style.width = "100px";

        var arrOptions = [];
        var arrLabels = [];

        for(var i = 0; i < g_validStatuses.length; i++)
        {

          var option = document.createElement("input");
          option.type = "checkbox";
          option.checked = g_statusesToHide.includes(g_validStatuses[i]) ? true : false;
          option.id = "status-" + g_validStatuses[i];
          option.onchange = ReloadHiddenStatuses;
          var label_option = document.createElement("label");
          label_option.style.padding = "10px";
          label_option.style.width = "100px";
          option.style.margin = "auto";


          option.style.width = "20px";
          option.style.height = "20px";

          label_option.appendChild(document.createTextNode(g_validStatuses[i]));
          arrLabels.push(label_option);
          arrOptions.push(option);
        }
        for(var i = 0; i < arrLabels.length; i++)
        {
          typeList.appendChild(arrLabels[i]);
        }
        for(var i = 0; i < arrOptions.length; i++)
        {
          typeList.appendChild(arrOptions[i]);
        }
        modal.appendChild(typeList);
        var closeBtn = document.createElement("button");
        closeBtn.appendChild(document.createTextNode("Close"));
        closeBtn.onclick = ToggleSettingsModal;
        modal.appendChild(closeBtn);

        document.body.appendChild(modal);
        g_modalElement = document.getElementById("hiddenSettingsModal");
        console.log("DroppedHider - Modal initilized")
    }

    toggleModal()
    {
        setModalState(!this.modalActive)
    }
    setModalState(state)
    {
        this.modalActive = state;
        _updateModal();
    }

    _updateModal()
    {

    }
    _toggleStyle(state)
    {
        var head = document.head || document.getElementsByTagName('head')[0];
        if(g_styleElement != null)
        {
            head.removeChild(g_styleElement);
            g_styleElement = null;
        }
        if(!state)
        {
            return;
        }
    }

}

const script_prefix = "Anilist Seer Integration";
const logger = new QLogger(script_prefix);
const seerrLib = new LibSeerr("http://localhost:5055");

var entryListNode = null;

function CheckURL(mutationList, observer)
{
    if(!document.body.contains(targetNode))
    {
        logger.Log("Lost search filter node - Assuming we switched page - Resetting to Initial state");
        AttatchInitObserver();
        observer.disconnect();
        mediaCardObserver.disconnect();
    }
}

function MediaCardCheck(mutationList,observer)
{
    for (const mutation of mutationList)
    {
        if(mutation.addedNodes.length == 0)
        {
            continue;
        }
        for(let node of mutation.addedNodes)
        {
            if(node.classList.contains("entry-card"))
            {
                ProcessNode(node);
            }
        }
    }
}

const mediaCardObserver = new MutationObserver(MediaCardCheck);
const pageUrlObserver = new MutationObserver(CheckURL);
var targetNode = document.getElementsByClassName("medialist cards")[0];


function ProcessNode(entryNode)
{
    let title = "";
            for(let u = 0; u < entryNode.children.length; u++)
            {
                if(entryNode.children[u].classList.contains("title"))
                {
                    title = entryNode.children[u].children[0].innerHTML.trim();
                    logger.Log("FOUND: " + title);
                    break;
                }
            }
            let node = entryNode;
            seerrLib.lookup(title).then(function (value) {

                let seerrResponseStatus = SEERR_STATUS.NOT_FOUND;

                logger.LogObject(node);
                //logger.LogObject(value);
                let seerrResponseData = JSON.parse(value.data);
                if(seerrResponseData.hasOwnProperty("results"))
                {
                    if(seerrResponseData.results.length == 0)
                    {
                        logger.Warn(title + " was not found in seerr");
                        addBadge(node,SEERR_STATUS.NOT_FOUND);
                        return;
                    }
                    let id = seerrResponseData.results[0].id;
                    let type = (seerrResponseData.results[0].hasOwnProperty("mediaInfo")) ? seerrResponseData.results[0].mediaInfo.mediaType : seerrResponseData.results[0].mediaType;
                    let seerrUrl = seerrLib.urlBase + "/" + type + "/" + id;
                    let seerrStatus = intToSeerStatus( (seerrResponseData.results[0].hasOwnProperty("mediaInfo")) ? seerrResponseData.results[0].mediaInfo.status : 1);
                    //logger.LogObject(seerrResponseData.results[0]);
                    logger.Log("Title: " + title + " was found at: " + seerrUrl + " - Status: " + seerrStatus);
                    addBadge(node,seerrStatus,seerrUrl);
                    
                }
                else
                {
                    logger.Warn(title + " caused an error in Seerr - Request failed");
                }
            });
}

function ProcessList()
{
    if(entryListNode == null)
    {
        logger.Log("No entry list found :(");
        return;
    }
    for(let i = 0; i < entryListNode.children.length; i++)
    {
        if(entryListNode.children[i].classList.contains("entry-card"))
        {
            ProcessNode(entryListNode.children[i]);
        }
    }
}

function SetUp_Remaining(mutationList, observer)
{
  for (const mutation of mutationList)
    {
      if(document.getElementsByClassName("medialist cards")[0])
        {
          logger.Log("Found UserList! :D")
          targetNode = document.getElementsByClassName("medialist cards")[0];
          entryListNode = document.getElementsByClassName("list-entries")[0];
          pageUrlObserver.observe(document.head, { attributes: false, childList: true, subtree: true });
          observer.disconnect();
          ProcessList();
          mediaCardObserver.observe(entryListNode, { attributes: false, childList: true, subtree: true });
          return;
        }
    }
 
}

const mo = new MutationObserver(SetUp_Remaining);

function AttatchInitObserver()
{
    mo.observe(document.body, { attributes: false, childList: true, subtree: true });
}





async function begin()
{
    logger.Log("Script loaded!");
    let seerrStatus = await seerrLib.getSeerrStatus();
    if(seerrStatus.reachable)
    {
        logger.Log("Seerr is up and reachable!");
    }
    else
    {
        logger.Error("Seerr at: " + seerrLib.urlBase + " is unreachable or not giving an ok.. Errorcode: " + seerrStatus.statusCode);
    }

}

begin();
AttatchInitObserver();