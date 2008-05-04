// ==UserScript==
// @name           AutoPagerize
// @namespace      http://swdyh.yu.to/
// @description    loading next page and inserting into current page.
// @include        *
// ==/UserScript==
//
// auther:  swdyh http://d.hatena.ne.jp/swdyh/
// version: 0.0.26 2008-03-30T00:12:14+09:00
//
// this script based on
// GoogleAutoPager(http://la.ma.la/blog/diary_200506231749.htm) and
// estseek autopager(http://la.ma.la/blog/diary_200601100209.htm).
// thanks to ma.la.
//
// Released under the GPL license
// http://www.gnu.org/copyleft/gpl.html
//

//if (window != window.parent) {
//    return
//}

var HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
var URL = 'http://userscripts.org/scripts/show/8551'
var VERSION = '0.0.26'
var DEBUG = false
var AUTO_START = true
var CACHE_EXPIRE = 24 * 60 * 60 * 1000
var BASE_REMAIN_HEIGHT = 400
var FORCE_TARGET_WINDOW = true
var SITEINFO_IMPORT_URLS = [
    'http://swdyh.infogami.com/autopagerize',
    // 'http://userjs.oh.land.to/pagerization/convert.php?file=siteinfo.v5',
]
var COLOR = {
    on: '#0f0',
    off: '#ccc',
    loading: '#0ff',
    terminated: '#00f',
    error: '#f0f'
}
var SITEINFO = [
    /* sample
    {
        url:          'http://(.*).google.+/(search).+',
        nextLink:     'id("navbar")//td[last()]/a',
        pageElement:  '//div[@id="res"]/div',
        exampleUrl:   'http://www.google.com/search?q=nsIObserver',
    },
    */
    /* template
    {
        url:          '',
        nextLink:     '',
        pageElement:  '',
        exampleUrl:   '',
    },
    */
]
var MICROFORMAT = {
    url:          '.*',
    nextLink:     '//a[@rel="next"] | //link[@rel="next"]',
    insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
    pageElement:  '//*[contains(@class, "autopagerize_page_element")]',
}

var AutoPager = function(info) {
    this.pageNum = 1
    this.info = info
    this.state = AUTO_START ? 'enable' : 'disable'
    var self = this
    var url = this.getNextURL(info.nextLink, document)

    if ( !url ) {
        debug("getNextURL returns null.", info.nextLink)
        return
    }
        debug("fjoiwajfoiajp.", info.nextLink)
    if (info.insertBefore) {
        this.insertPoint = getFirstElementByXPath(info.insertBefore)
    }

    if (!this.insertPoint) {
        var lastPageElement = getElementsByXPath(info.pageElement).pop()
        if (lastPageElement) {
            this.insertPoint = lastPageElement.nextSibling ||
                lastPageElement.parentNode.appendChild(document.createTextNode(' '))
        }
    }

    if (!this.insertPoint) {
        debug("insertPoint not found.", lastPageElement, info.pageElement)
        return
    }

    this.requestURL = url
    this.loadedURLs = {}
    var toggle = function() {self.stateToggle()}
    this.toggle = toggle
    GM_registerMenuCommand('AutoPagerize - on/off', toggle)
    this.scroll= function() { self.onScroll() }
    window.addEventListener("scroll", this.scroll, false)
    this.initIcon()
    this.initHelp()
    this.icon.addEventListener("mouseover",
        function(){self.viewHelp()}, true)
    var scrollHeight = getScrollHeight()
    var bottom = getElementPosition(this.insertPoint).top ||
        this.getPageElementsBottom() ||
        (Math.round(scrollHeight * 0.8))
    this.remainHeight = scrollHeight - bottom + BASE_REMAIN_HEIGHT
    this.onScroll()
}

AutoPager.prototype.getPageElementsBottom = function() {
    try {
        var elem = getElementsByXPath(this.info.pageElement).pop()
        return getElementBottom(elem)
    }
    catch(e) {}
}

AutoPager.prototype.initHelp = function() {
    var helpDiv = document.createElement('div')
    helpDiv.setAttribute('id', 'autopagerize_help')
    helpDiv.setAttribute('style', 'padding:5px;position:fixed;' +
                     'top:-200px;right:3px;font-size:10px;' +
                     'background:#fff;color:#000;border:1px solid #ccc;' +
                     'z-index:256;text-align:left;font-weight:normal;' +
                     'line-height:120%;font-family:verdana;')

    var toggleDiv = document.createElement('div')
    toggleDiv.setAttribute('style', 'margin:0 0 0 50px;')
    var a = document.createElement('a')
    a.setAttribute('class', 'autopagerize_link')
    a.innerHTML = 'on/off'
    a.href = 'javascript:void(0)'
    var self = this
    var toggle = function() {
        self.stateToggle()
        helpDiv.style.top = '-200px'
    }
    a.addEventListener('click', toggle, false)
    toggleDiv.appendChild(a)

    var s = '<div style="width:100px; float:left;">'
    for (var i in COLOR) {
        s += '<div style="float:left;width:1em;height:1em;' +
            'margin:0 3px;background-color:' + COLOR[i] + ';' +
            '"></div><div style="margin0 3px">' + i + '</div>'
    }
    s += '</div>'
    var colorDiv = document.createElement('div')
    colorDiv.innerHTML = s
    helpDiv.appendChild(colorDiv)
    helpDiv.appendChild(toggleDiv)

    var versionDiv = document.createElement('div')
    versionDiv.setAttribute('style', 'clear:both;')
    versionDiv.innerHTML = '<a href="' + URL +
        '">AutoPagerize</a> ver ' + VERSION
    helpDiv.appendChild(versionDiv)
    document.body.appendChild(helpDiv)

    var proc = function(e) {
        var c_style = document.defaultView.getComputedStyle(helpDiv, '')
        var s = ['top', 'left', 'height', 'width'].map(function(i) {
            return parseInt(c_style.getPropertyValue(i)) })
        if (e.clientX < s[1] || e.clientX > (s[1] + s[3] + 11) ||
            e.clientY < s[0] || e.clientY > (s[0] + s[2] + 11)) {
                helpDiv.style.top = '-200px'
        }
    }
    helpDiv.addEventListener('mouseout', proc, false)
    this.helpLayer = helpDiv
}

AutoPager.prototype.viewHelp = function() {
    this.helpLayer.style.top = '3px'
}

AutoPager.prototype.onScroll = function() {
    var scrollHeight = Math.max(document.documentElement.scrollHeight,
                                document.body.scrollHeight)
    var remain = scrollHeight - window.innerHeight - window.scrollY
    if (this.state == 'enable' && remain < this.remainHeight) {
          this.request()
    }
}

AutoPager.prototype.stateToggle = function() {
    if (this.state == 'enable') {
        this.disable()
    }
    else {
        this.enable()
    }
}

AutoPager.prototype.enable = function() {
    this.state = 'enable'
    this.icon.style.background = COLOR['on']
    this.icon.style.opacity = 1
}

AutoPager.prototype.disable = function() {
    this.state = 'disable'
    this.icon.style.background = COLOR['off']
    this.icon.style.opacity = 0.5
}

AutoPager.prototype.request = function() {
    if (!this.requestURL || this.lastRequestURL == this.requestURL) {
        return
    }
    if (!isSameDomain(this.requestURL)) {
        this.error()
        return
    }
    this.lastRequestURL = this.requestURL
    var self = this
    var mime = 'text/html; charset=' + document.characterSet
    var opt = {
        method: 'get',
        url: this.requestURL,
        overrideMimeType: mime,
        onerror: this.error,
        onload: function(res){
            self.requestLoad.apply(self, [res])
        }
    }
    this.showLoading(true)
    GM_xmlhttpRequest(opt)
}

AutoPager.prototype.showLoading = function(sw) {
    if (sw) {
        this.icon.style.background = COLOR['loading']
    }
    else {
        this.icon.style.background = COLOR['on']
    }
}

AutoPager.prototype.requestLoad = function(res) {
    var t = res.responseText
    var htmlDoc = createHTMLDocumentByString(t)
    AutoPager.documentFilters.forEach(function(i) {
        i(htmlDoc, this.requestURL, this.info)
    }, this)
    try {
        var page = getElementsByXPath(this.info.pageElement, htmlDoc)
        var url = this.getNextURL(this.info.nextLink, htmlDoc)
    }
    catch(e){
        log(e)
        this.error()
        return
    }

    if (!page || page.length < 1 ) {
        debug('pageElement not found.' , this.info.pageElement)
        this.terminate()
        return
    }

    if (this.loadedURLs[this.requestURL]) {
        debug('page is already loaded.', this.requestURL, this.info.nextLink)
        this.terminate()
        return
    }

    this.loadedURLs[this.requestURL] = true
    page = this.addPage(htmlDoc, page)
    AutoPager.filters.forEach(function(i) {
        i(page)
    })
    this.requestURL = url
    this.showLoading(false)
    this.onScroll()
    if (!url) {
        debug('nextLink not found.', this.info.nextLink, htmlDoc)
        this.terminate()
    }
}

AutoPager.prototype.addPage = function(htmlDoc, page) {
    var hr = document.createElementNS(HTML_NAMESPACE, 'hr')
    var p = document.createElementNS(HTML_NAMESPACE, 'p')
    var self = this
    this.insertPoint.parentNode.insertBefore(hr, this.insertPoint)
    this.insertPoint.parentNode.insertBefore(p, this.insertPoint)
    p.innerHTML = 'page: <a class="autopagerize_link" href="' +
        this.requestURL + '">' + (++this.pageNum) + '</a>'
    return page.map(function(i) {
        var pe = document.importNode(i, true)
        self.insertPoint.parentNode.insertBefore(pe, self.insertPoint)
        return pe
    })
}

AutoPager.prototype.initIcon = function() {
    var div = document.createElement("div")
    div.setAttribute('id', 'autopagerize_icon')
    with (div.style) {
        fontSize   = '12px'
        position   = 'fixed'
        top        = '3px'
        right      = '3px'
        background = COLOR['on']
        color      = '#fff'
        width = '10px'
        height = '10px'
        zIndex = '255'
        if (this.state != 'enable') {
            background = COLOR['off']
        }
    }
    document.body.appendChild(div)
    this.icon = div
}

AutoPager.prototype.getNextURL = function(xpath, doc) {
    var next = getFirstElementByXPath(xpath, doc)
    if (next) {
        var url = next.href || next.action || next.value
        if (!url.match(/^http:/)) {
            url = pathToURL(url)
        }
        return url
    }
}

AutoPager.prototype.terminate = function() {
    this.icon.style.background = COLOR['terminated']
    window.removeEventListener('scroll', this.scroll, false)
    var self = this
    setTimeout(function() {
        self.icon.parentNode.removeChild(self.icon)
    }, 1500)
}

AutoPager.prototype.error = function() {
    this.icon.style.background = COLOR['error']
    window.removeEventListener('scroll', this.scroll, false)
}

AutoPager.documentFilters = []
AutoPager.filters = []

var parseInfo = function(str) {
    var lines = str.split(/\r\n|\r|\n/)
    var re = /(^[^:]*?):(.*)$/
    var strip = function(str) {
        return str.replace(/^\s*/, '').replace(/\s*$/, '')
    }
    var info = {}
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].match(re)) {
            info[RegExp.$1] = strip(RegExp.$2)
        }
    }
    var isValid = function(info) {
        var infoProp = ['url', 'nextLink', 'pageElement']
        for (var i = 0; i < infoProp.length; i++) {
            if (!info[infoProp[i]]) {
                return false
            }
        }
        return true
    }
    return isValid(info) ? info : null
}
var launchAutoPager = function(list) {
    for (var i = 0; i < list.length; i++) {
        try {
            if (ap) {
                return
            }
            else if (!location.href.match(list[i].url)) {
            }
            else if (!getFirstElementByXPath(list[i].nextLink)) {
                // FIXME microformats case detection.
                // limiting greater than 12 to filter microformats like SITEINFOs.
                if (list[i].url.length > 12 ) {
                    debug("nextLink not found.", list[i].nextLink)
                }
            }
            else if (!getFirstElementByXPath(list[i].pageElement)) {
                if (list[i].url.length > 12 ) {
                    debug("pageElement not found.", list[i].pageElement)
                }
            }
            else {
                ap = new AutoPager(list[i])
                return
            }
        }
        catch(e) {
            log(e)
            continue
        }
    }
}
var clearCache = function() {
    GM_setValue('cacheInfo', '')
}
var getCache = function() {
    return eval(GM_getValue('cacheInfo')) || {}
}
var getCacheCallback = function(res, url) {
    if (res.status != 200) {
        return getCacheErrorCallback(url)
    }

    var info = []
    var matched = false
    var hdoc = createHTMLDocumentByString(res.responseText)
    var textareas = getElementsByXPath(
        '//*[@class="autopagerize_data"]', hdoc)
    textareas.forEach(function(textarea) {
        var d = parseInfo(textarea.value)
        if (d) {
            info.push(d)
            if (!matched && location.href.match(d.url)) {
                matched = d
            }
        }
    })
    if (info.length > 0) {
        cacheInfo[url] = {
            url: url,
            expire: new Date(new Date().getTime() + CACHE_EXPIRE),
            info: info
        }
        GM_setValue('cacheInfo', cacheInfo.toSource())
        if (!ap && matched) {
            ap = new AutoPager(matched)
        }
    }
}
var getCacheErrorCallback = function(url) {
    var expire = new Date(new Date().getTime() + CACHE_EXPIRE)
    if (cacheInfo[url]) {
        cacheInfo[url].expire = expire
        launchAutoPager(cacheInfo[url].info)
    }
    else {
        cacheInfo[url] = {
            url: url,
            expire: expire,
            info: []
        }
    }
    GM_setValue('cacheInfo', cacheInfo.toSource())
}

if (FORCE_TARGET_WINDOW) {
    var setTargetBlank = function(doc) {
        var anchers = getElementsByXPath('descendant-or-self::a', doc)
        anchers.forEach(function(i) {
            if (i.getAttribute('href') &&
                !i.getAttribute('href').match(/^#/) &&
                i.className.indexOf('autopagerize_link') < 0) {
                i.target = '_blank'
            }
        })
    }
    AutoPager.documentFilters.push(setTargetBlank)
}
if (typeof(window.AutoPagerize) == 'undefined') {
    window.AutoPagerize = {}
    window.AutoPagerize.addFilter = function(f) {
        AutoPager.filters.push(f)
    }
    window.AutoPagerize.addDocumentFilter = function(f) {
        AutoPager.documentFilters.push(f)
    }
}

GM_registerMenuCommand('AutoPagerize - clear cache', clearCache)
var ap = null
launchAutoPager(SITEINFO)
var cacheInfo = getCache()
SITEINFO_IMPORT_URLS.forEach(function(i) {
    if (!cacheInfo[i] || cacheInfo[i].expire < new Date()) {
        var opt = {
            method: 'get',
            url: i,
            onload: function(res) {getCacheCallback(res, i)},
            onerror: function(res){getCacheErrorCallback(i)},
        }
        GM_xmlhttpRequest(opt)
    }
    else {
        launchAutoPager(cacheInfo[i].info)
    }
})
launchAutoPager([MICROFORMAT])
return

// utility functions.
function createHTMLDocumentByString(str) {
    var html = str.replace(/<!DOCTYPE.*?>/, '').replace(/<html.*?>/, '').replace(/<\/html>.*/, '')
    var htmlDoc  = document.implementation.createDocument(null, 'html', null)
    var fragment = createDocumentFragmentByString(html)
    try {
        fragment = htmlDoc.adoptNode(fragment)
    } catch(e) {
        fragment = htmlDoc.importNode(fragment, true)
    }
    htmlDoc.documentElement.appendChild(fragment)
   return htmlDoc
}

function getElementsByXPath(xpath, node) {
    var node = node || document
    var doc = node.ownerDocument ? node.ownerDocument : node
    var nodesSnapshot = doc.evaluate(xpath, node, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
    var data = []
    for (var i = 0; i < nodesSnapshot.snapshotLength; i++) {
        data.push(nodesSnapshot.snapshotItem(i))
    }
    return data
}

function getFirstElementByXPath(xpath, node) {
    var node = node || document
    var doc = node.ownerDocument ? node.ownerDocument : node
    var result = doc.evaluate(xpath, node, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null)
    return result.singleNodeValue ? result.singleNodeValue : null
}

function createDocumentFragmentByString(str) {
    var range = document.createRange()
    range.setStartAfter(document.body)
    return range.createContextualFragment(str)
}

function log(message) {
    if (typeof console == 'object') {
        console.log(message)
    }
    else {
        GM_log(message)
    }
}

function debug() {
    if ( typeof DEBUG != 'undefined' && DEBUG ) {
        console.log.apply(this, arguments)
    }
}

function getElementPosition(elem) {
    var offsetTrail = elem
    var offsetLeft  = 0
    var offsetTop   = 0
    while (offsetTrail) {
        offsetLeft += offsetTrail.offsetLeft
        offsetTop  += offsetTrail.offsetTop
        offsetTrail = offsetTrail.offsetParent
    }
    offsetTop = offsetTop || null
    offsetLeft = offsetLeft || null
    return {left: offsetLeft, top: offsetTop}
}

function getElementBottom(elem) {
    var c_style = document.defaultView.getComputedStyle(elem, '')
    var height  = 0
    var prop    = ['height', 'borderTopWidth', 'borderBottomWidth',
                   'paddingTop', 'paddingBottom',
                   'marginTop', 'marginBottom']
    prop.forEach(function(i) {
        var h = parseInt(c_style[i])
        if (typeof h == 'number') {
            height += h
        }
    })
    var top = getElementPosition(elem).top
    return top ? (top + height) : null
}

function getScrollHeight() {
    return Math.max(document.documentElement.scrollHeight,
                                document.body.scrollHeight)
}

function pathToURL(path) {
    var link = document.createElement('a')
    link.href = path
    return link.href
}

function isSameDomain(url) {
    return location.host == url.split('/')[2]
}
