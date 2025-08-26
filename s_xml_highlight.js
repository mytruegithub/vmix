// XML Highlighting Library
class XMLHighlighter {
    constructor() {
        this.colors = {
            tag: '#ff6b6b',
            attribute: '#4ecdc4',
            value: '#45b7d1',
            text: '#ffffff',
            comment: '#95a5a6',
            cdata: '#f39c12'
        };
    }

    highlight(xmlString) {
        return xmlString
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(".*?")/g, '<span style="color: ' + this.colors.value + '">$1</span>')
            .replace(/(\w+)=/g, '<span style="color: ' + this.colors.attribute + '">$1</span>=')
            .replace(/&lt;(\/?)(\w+)/g, '&lt;$1<span style="color: ' + this.colors.tag + '">$2</span>')
            .replace(/&lt;(\/?)(\w+)([^&]*?)&gt;/g, function(match, slash, tag, attrs) {
                return '&lt;' + slash + '<span style="color: ' + this.colors.tag + '">' + tag + '</span>' + attrs + '&gt;';
            }.bind(this));
    }

    format(xmlString) {
        let formatted = '';
        let indent = '';
        const tab = '    ';
        
        xmlString.split(/>\s*</).forEach(function(node) {
            if (node.match(/^\/\w/)) {
                indent = indent.substring(tab.length);
            }
            formatted += indent + '<' + node + '>\r\n';
            if (node.match(/^<?\w[^>]*[^\/]$/)) {
                indent += tab;
            }
        });
        
        return formatted.substring(1, formatted.length - 3);
    }
}

window.xmlHighlighter = new XMLHighlighter();

