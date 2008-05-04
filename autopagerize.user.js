// ==UserScript==
// @name           AutoPagerize
// @namespace      http://swdyh.yu.to/
// @description    loading next page and inserting into current page.
// @include        *
// ==/UserScript==
//
// auther:  youhei
// version: 0.0.5 2007.1.24 03:29:48
//
// this script based on
// GoogleAutoPager(http://la.ma.la/blog/diary_200506231749.htm) and
// estseek autopager(http://la.ma.la/blog/diary_200601100209.htm).
// thanks to ma.la.
//
// Released under the GPL license
// http://www.gnu.org/copyleft/gpl.html
//
(function() {
    var HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

    var DEBUG_MODE = false
    var DEFAULT_STATE = 'enable'
    var CACHE_EXPIRE = 24 * 60 * 60 * 1000
    var SITEINFO_IMPORT_URLS = [
        'http://swdyh.infogami.com/autopagerize',
    ]
    var SITEINFO = [
        {
            url: 'http://www.google.*/search*',
            nextLink: 'id("navbar")/table/tbody/tr/td[last()]/a',
            insertBefore: 'id("navbar")',
            pageElement: '//div[2]',
            remainHeight: 800
        },
        /* template
        {
            url:          '',
            nextLink:     '',
            insertBefore: '',
            pageElement:  '',
            remainHeight: 500
        },
        */
    ]

    var AutoPager = function(info, state) {
        this.pageNum = 1
        this.info    = info
        this.state   = state
        var url = this.getNextURL(info.nextLink, document)
        this.insertPoint = getFirstElementByXPath(info.insertBefore)
        if (!url || !this.insertPoint) {
            return
        }
        this.requestURL = url
        this.loadedURLs = []
        var toggle = function() {ap.stateToggle.apply(ap)}
        this.toggle = toggle
        GM_registerMenuCommand('AutoPagerize - on/off', toggle)
        this.scroll = function() {ap.onScroll.apply(ap)}
        document.body.addEventListener("dblclick", this.toggle, true)
        window.addEventListener("scroll", this.scroll, true)
        this.initMessage('AutoPager')
    }
    AutoPager.prototype.onScroll = function() {
        var remain = document.documentElement.scrollHeight -
            window.innerHeight - window.scrollY
        if (this.state == 'enable' && remain < this.info.remainHeight) {
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
        this.message.style.visibility = 'visible'
    }
    AutoPager.prototype.disable = function() {
        this.state = 'disable'
        this.message.style.visibility = 'hidden'
    }
    AutoPager.prototype.request = function() {
        if (this.lastRequestURL == this.requestURL) {
            return
        }
        this.lastRequestURL = this.requestURL
        var self = this
        var opt = {method: 'get', url: this.requestURL,
            onload: function(res){self.requestLoad.apply(self, [res])}}
        this.showLoading(true)
        GM_xmlhttpRequest(opt)
    }
    AutoPager.prototype.showLoading = function(sw) {
        if (sw) {
            this.message.innerHTML = 'Loading...'
            this.message.style.background = '#0ff'
        }
        else {
            this.message.innerHTML = 'AutoPager'
            this.message.style.background = '#0f0'
        }
    }
    AutoPager.prototype.requestLoad = function(res) {
        var t = res.responseText
        var htmlDoc = createHTMLDocumentByString(t)
        try {
            var url = this.getNextURL(this.info.nextLink, htmlDoc)
            var page = getFirstElementByXPath(this.info.pageElement, htmlDoc)
        }
        catch(e){
            unsafeWindow.console.log(e)
            this.terminate()
            return
        }

        if (!url || !page) {
            this.terminate()
            return
        }
        for (var i = 0; i < this.loadedURLs.length; i++) {
            if (this.loadedURLs[i] == this.requestURL) {
                this.terminate()
                return
            }
        }
        this.loadedURLs.push(this.requestURL)
        this.requestURL = url
        this.addPage(htmlDoc, page)
        this.showLoading(false)
    }
    AutoPager.prototype.addPage = function(htmlDoc, page) {
        var hr = htmlDoc.createElementNS(HTML_NAMESPACE, 'hr')
        var p = htmlDoc.createElementNS(HTML_NAMESPACE, 'p')
        p.appendChild(htmlDoc.createTextNode('page: ' + (++this.pageNum)))
        this.insertPoint.parentNode.insertBefore(hr, this.insertPoint)
        this.insertPoint.parentNode.insertBefore(p, this.insertPoint)
        this.insertPoint.parentNode.insertBefore(page, this.insertPoint)
    }
    AutoPager.prototype.initMessage = function(message) {
        var div = document.createElement("div")
        div.innerHTML = message
        with (div.style) {
            fontSize   = '12px'
            fontWeight = 'bold'
            position   = 'fixed'
            top        = '3px'
            right      = '3px'
            padding    = '0.3em'
            background = '#0f0'
            color      = '#fff'
            opacity    = '0.8'
            if (this.state != 'enable') {
                visibility = 'hidden'
            }
        }
        document.body.appendChild(div)
        this.message = div
    }
    AutoPager.prototype.getNextURL = function(xpath, doc) {
        var next = getFirstElementByXPath(xpath, doc)
        if (next) {
            return next.href
        }
    }
    AutoPager.prototype.terminate = function() {
        this.message.innerHTML        = 'terminate'
        this.message.style.background = '#00f'
        window.removeEventListener('scroll', this.scroll, true)
        document.body.removeEventListener("dblclick", this.toggle, true)
        var self = this
        setTimeout(function() {
            self.message.parentNode.removeChild(self.message)
        }, 1500)
    }

    var parseInfo = function(str) {
        var lines = str.split(/\r\n|\r|\n/)
        var re = /(^[^:]*?):(.*)$/
        var strip = function(str) {
            return str.replace(/^\s*/, '').replace(/\s*$/, '')
        }
        var info = {}
        for(var i = 0; i < lines.length; i++) {
            if (lines[i].match(re)) {
                info[RegExp.$1] = strip(RegExp.$2)
            }
        }
        info.remainHeight = parseInt(info.remainHeight)
        var isValid = function(info) {
            var infoProp = ['nextLink', 'insertBefore',
                            'pageElement', 'remainHeight']
            for (var i = 0; i < infoProp.length; i++) {
                if (!infoProp[i]) {
                    return false
                }
            }
            return true
        }
        return isValid(info) ? info : null
    }
    var launchAutoPager = function(list) {
        for (var i = 0; i < list.length; i++) {
            if (location.href.match(list[i].url)) {
                ap = new AutoPager(list[i], DEFAULT_STATE)
                return true
            }
        }
        return false
    }
    var clearCache = function() {
        GM_setValue('cacheInfo', '')
    }

    // initialize
    GM_registerMenuCommand('AutoPagerize - clear cache', clearCache)
    var ap = null
    if (launchAutoPager(SITEINFO)) {
        return
    }
    var cacheInfo = eval(GM_getValue('cacheInfo')) || {}
    var callback = function(res, url) {
        if (ap) {
            return
        }
        var hdoc = createHTMLDocumentByString(res.responseText)
        var textareas = getElementsByXPath(
            '//textarea[@class="autopagerize_data"]', hdoc)
        if (!textareas) {
            return
        }
        var info = []
        var matched
        textareas.forEach(function(textarea) {
            var d = parseInfo(textarea.value)
            if (d) {
                info.push(d)
                if (!matched && location.href.match(d.url)) {
                    matched = d
                }
            }
        })
        var now = new Date()
        cacheInfo[url] = {
            url: url,
            expire: new Date(now.getTime() + CACHE_EXPIRE),
            info: info
        }
        GM_setValue('cacheInfo', cacheInfo.toSource())
        if (matched) {
            ap = new AutoPager(matched, DEFAULT_STATE)
        }
    }
    for (var i = 0; i < SITEINFO_IMPORT_URLS.length; i++) {
        if (ap) {
            return
        }
        var url = SITEINFO_IMPORT_URLS[i]
        if (cacheInfo[url] && cacheInfo[url].expire > new Date()) {
            if (launchAutoPager(cacheInfo[url].info)) {
                return
            }
            else {
                continue
            }
        }
        var opt = {
            method: 'get',
            url: url,
            onload: function(res){callback(res, url)},
        }
        GM_xmlhttpRequest(opt)
    }
    return

    // utility functions.
    function createHTMLDocumentByString(str) {
        var html = str.replace(/<!DOCTYPE.*?>/, '').replace(/<html.*?>/, '').replace(/<\/html>.*/, '')
        var htmlDoc  = document.implementation.createDocument(null, 'html', null)
        var fragment = createDocumentFragmentByString(html)
        htmlDoc.documentElement.appendChild(fragment)
        return htmlDoc
    }
    function getElementsByXPath(xpath, doc) {
        var doc = doc || document
        var iterator = doc.evaluate(xpath, doc, null,
            XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
        var data = []
        var node = iterator.iterateNext()
        while(node) {
            data.push(node)
            node = iterator.iterateNext()
        }
        return (data.length > 1) ? data : null
    }
    function getFirstElementByXPath(xpath, doc) {
        var doc = doc || document
        var result = doc.evaluate(xpath, doc, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        // for search element
        if (DEBUG_MODE) {
            var rule = [".match{border: 3px solid #f00}\n",
                        ".match:after{content:'", xpath, "'}\n"].join('')
            addGlobalStyle(rule)
            result.singleNodeValue.className = 
                result.singleNodeValue.className + ' match'
        }
        return result.singleNodeValue ? result.singleNodeValue : null
    }
    function createDocumentFragmentByString(str) {
        var range = document.createRange()
        range.setStartAfter(document.body)
        return range.createContextualFragment(str)
    }
    // http://diveintogreasemonkey.org/patterns/add-css.html
    function addGlobalStyle(css) {
        var head
        head = document.getElementsByTagName('head')[0]
        if (head) {
            var style = document.createElement('style')
            style.type = 'text/css'
            style.innerHTML = css
            head.appendChild(style)
        }
    }
})()
