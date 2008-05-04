// ==UserScript==
// @name           AutoPagerize
// @namespace      http://swdyh.yu.to/
// @description    loading next page and inserting into current page.
// @include        *
// ==/UserScript==
//
// auther:  youhei
// version: 0.0.1 (2007.1.13 04:08:40)
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
    var AutoPager = function(info, state) {
        this.pageNum   = 1
        this.info       = info
        this.state      = state
        var url = this.getNextURL(info.nextLink, document)
        if (!url) {
            return
        }
        this.requestURL = url
        this.toggle = function() {ap.stateToggle.apply(ap)}
        this.scroll = function() {ap.onScroll.apply(ap)}
        document.body.addEventListener("dblclick", this.toggle, true)
        window.addEventListener("scroll", this.scroll, true)
        this.insertPoint = getElementByXPath(info.insertBefore)
        this.initMessage('AutoPager')
    }
    AutoPager.prototype.onScroll = function() {
        var remain = document.documentElement.scrollHeight - window.scrollY
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
        if (this.requested == this.requestURL) {
            return
        }
        this.requested = this.requestURL
        this.showLoading(true)
        var self = this
        var opt = {method: 'get', url: this.requestURL,
            onload: function(res){self.requestLoad.apply(self, [res])}}
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
        t = t.replace(/<html.*?>/, '').replace(/<\/html>/, '')
        var htmlDoc  = document.implementation.createDocument(
            HTML_NAMESPACE, 'html', null)
        var fragment = createDocumentFragmentByString(t)
        htmlDoc.documentElement.appendChild(fragment)

        var url = this.getNextURL(this.info.nextLink, htmlDoc)
        var page = getElementByXPath(this.info.pageElement, htmlDoc)
        if (!url || !page) {
            this.terminate()
            return
        }
        this.requestURL = url
        var hr = htmlDoc.createElementNS(HTML_NAMESPACE, 'hr')
        var p  = htmlDoc.createElementNS(HTML_NAMESPACE, 'p')
        p.appendChild(htmlDoc.createTextNode('page: ' + ++this.pageNum))
        this.insertPoint.parentNode.insertBefore(hr, this.insertPoint)
        this.insertPoint.parentNode.insertBefore(p, this.insertPoint)
        this.insertPoint.parentNode.insertBefore(page, this.insertPoint)
        this.showLoading(false)
    }
    AutoPager.prototype.initMessage = function(message) {
        var div = document.createElement("div")
        div.innerHTML = message
        with (div.style) {
            position   = 'fixed'
            top        = '1%'
            right      = '1%'
            padding    = '0.3em'
            background = '#0f0'
            color      = '#fff'
            if (this.state != 'enable') {
                visibility = 'hidden'
            }
        }
        document.body.appendChild(div)
        this.message = div
    }
    AutoPager.prototype.getNextURL = function(xpath, doc) {
        var next = getElementByXPath(xpath, doc)
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
    var HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

    // initialize.
    var info = getInfo()
    for (var i in info) {
        if (location.href.match(i)) {
            var ap = new AutoPager(info[i], 'disable')
            return
        }
    }
    return

    // site data.
    function getInfo() {
        return {
            'http://www.google.*/search*': {
                nextLink:     'id("navbar")/table/tbody/tr/td[last()]/a',
                insertBefore: 'id("navbar")',
                pageElement:  '//div[2]',
                remainHeight: 800
            },
            'http://del.icio.us/*': {
                nextLink:     '//a[@accesskey="e"]',
                insertBefore: 'id("bottom")',
                pageElement:  'id("main")',
                remainHeight: 800
            },
            'http://search.yahoo.co.jp/search*': {
                nextLink:     'id("yschpg")/p/big[last()]/a',
                insertBefore: 'id("yschpg")',
                pageElement:  'id("yschweb")',
                remainHeight: 800
            },
            'http://search.auctions.yahoo.co.jp/jp/search': {
                nextLink:     '//td[@align="right" and @width="1%"]/small/b[last()]/a',
                insertBefore: '//table[position()=11]',
                pageElement:  '//table[position()=7]',
                remainHeight: 1200
            }
        }
    }

    // utility functions.
    function getElementByXPath(xpath, doc) {
        var doc = doc || document
        var result = doc.evaluate(xpath, doc, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            // for search element
            // result.singleNodeValue.style.border = "3px solid #f00"
        return result.singleNodeValue ? result.singleNodeValue : null
    }
    function createDocumentFragmentByString(str) {
        var range = document.createRange()
        range.setStartAfter(document.body)
        return range.createContextualFragment(str)
    }
})()
