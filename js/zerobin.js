/**
 * ZeroBin 0.15
 *
 * @link http://sebsauvage.net/wiki/doku.php?id=php:zerobin
 * @author sebsauvage
 */

// Immediately start random number generator collector.
sjcl.random.startCollectors();

/**
 *  Converts a duration (in seconds) into human readable format.
 *
 *  @param int seconds
 *  @return string
 */
function secondsToHuman(seconds)
{
    if (seconds<60) { var v=Math.floor(seconds); return v+' second'+((v>1)?'s':''); }
    if (seconds<60*60) { var v=Math.floor(seconds/60); return v+' minute'+((v>1)?'s':''); }
    if (seconds<60*60*24) { var v=Math.floor(seconds/(60*60)); return v+' hour'+((v>1)?'s':''); }
    // If less than 2 months, display in days:
    if (seconds<60*60*24*60) { var v=Math.floor(seconds/(60*60*24)); return v+' day'+((v>1)?'s':''); }
    var v=Math.floor(seconds/(60*60*24*30)); return v+' month'+((v>1)?'s':'');
}

/**
 * Compress a message (deflate compression). Returns base64 encoded data.
 *
 * @param string message
 * @return base64 string data
 */
function compress(message) {
    return Base64.toBase64( RawDeflate.deflate( Base64.utob(message) ) );
}

/**
 * Decompress a message compressed with compress().
 */
function decompress(data) {
    return Base64.btou( RawDeflate.inflate( Base64.fromBase64(data) ) );
}

/**
 * Compress, then encrypt message with key.
 *
 * @param string key
 * @param string message
 * @return encrypted string data
 */
function zeroCipher(key, message) {
    return sjcl.encrypt(key,compress(message));
}
/**
 *  Decrypt message with key, then decompress.
 *
 *  @param key
 *  @param encrypted string data
 *  @return string readable message
 */
function zeroDecipher(key, data) {
    return decompress(sjcl.decrypt(key,data));
}

/**
 * @return the current script location (without search or hash part of the URL).
 *   eg. http://server.com/zero/?aaaa#bbbb --> http://server.com/zero/
 */
function scriptLocation() {
    return window.location.href.substring(0,window.location.href.length
               -window.location.search.length -window.location.hash.length);
}

/**
 * @return the paste unique identifier from the URL
 *   eg. 'c05354954c49a487'
 */
function pasteID() {
    return window.location.search.substring(1);
}

/**
 * Set text of a DOM element (required for IE)
 * This is equivalent to element.text(text)
 * @param object element : a DOM element.
 * @param string text : the text to enter.
 */
function setElementText(element, text) {
    // For IE<10.
    if ($('div#oldienotice').is(":visible")) {
        // IE<10 do not support white-space:pre-wrap; so we have to do this BIG UGLY STINKING THING.
        element.text(text.replace(/\n/ig,'{BIG_UGLY_STINKING_THING__OH_GOD_I_HATE_IE}'));
        element.html(element.text().replace(/{BIG_UGLY_STINKING_THING__OH_GOD_I_HATE_IE}/ig,"\r\n<br>"));
    }
    // for other (sane) browsers:
    else {
        element.text(text);
    }
}

/**
 * Show decrypted text in the display area, including discussion (if open)
 *
 * @param string key : decryption key
 * @param array comments : Array of messages to display (items = array with keys ('data','meta')
 */
function displayMessages(key, comments) {
    try { // Try to decrypt the paste.
        var cleartext = zeroDecipher(key, comments[0].data);
    } catch(err) {
        $('pre#cleartext').hide();
        showError('Error: Could not decrypt data.');
        return;
    }
    setElementText($('pre#cleartext'), cleartext);
    urls2links($('pre#cleartext')); // Convert URLs to clickable links.
    $('pre#cleartext').snippet(comments[0].meta.language, {style:"ide-codewarrior"});

    // Display paste expiration.
    if (comments[0].meta.expire_date) {
        $('div#remainingtime')
            .html('<i class="icon-time"></i> This document will expire in '+secondsToHuman(comments[0].meta.remaining_time)+'.')
            .show();
    }
    if (comments[0].meta.burnafterreading) {
        $('div#remainingtime')
            .addClass('alert-error')
            .html('<i class="icon-fire"></i> <strong>FOR YOUR EYES ONLY.</strong> Don\'t close this window, this message will self destruct.')
            .show();
    }

    // If the discussion is opened on this paste, display it.
    if (comments[0].meta.opendiscussion) {
        $('div#comments').html('');
        // For each comment.
        for (var i = 1; i < comments.length; i++) {
            var comment=comments[i];
            var cleartext="[Could not decrypt comment ; Wrong key ?]";
            try {
                cleartext = zeroDecipher(key, comment.data);
            } catch(err) { }
            var place = $('div#comments');
            // If parent comment exists, display below (CSS will automatically shift it right.)
            var cname = 'div#comment_'+comment.meta.parentid

            // If the element exists in page
            if ($(cname).length) {
                place = $(cname);
            }
            var divComment = $('<div class="row"><div class="span12"><div class="comment" id="comment_' + comment.meta.commentid+'">'
                               + '<div class="commentmeta"><strong class="nickname"></strong><span class="commentdate muted"></span></div><div class="commentdata"></div>'
                               + '</div></div></div>');
            setElementText(divComment.find('div.commentdata'), cleartext);
            // Convert URLs to clickable links in comment.
            urls2links(divComment.find('div.commentdata'));
            divComment.find('strong.nickname').html('<i>(Anonymous)</i>');

            // Try to get optional nickname:
            try {
                divComment.find('strong.nickname').text(zeroDecipher(key, comment.meta.nickname));
            } catch(err) { }
            divComment.find('span.commentdate').text(' - '+(new Date(comment.meta.postdate*1000).toUTCString())+' ').attr('title','CommentID: ' + comment.meta.commentid);

            // If an avatar is available, display it.
            if (comment.meta.vizhash) {
                divComment.find('strong.nickname').before('<img src="' + comment.meta.vizhash + '" class="vizhash" title="Anonymous avatar (Vizhash of the IP address)" />');
            }

            place.append(divComment);
        }
        $('div#comments').append('<div class="comment"><div class="row"><div class="span12"><button class="btn" onclick="open_reply($(this),\'' + pasteID() + '\');return false;">Add comment</button></div></div></div>');
        $('div#discussion').show();
    }
}

/**
 * Open the comment entry when clicking the "Reply" button of a comment.
 * @param object source : element which emitted the event.
 * @param string commentid = identifier of the comment we want to reply to.
 */
function open_reply(source, commentid) {
    $('div.reply').remove(); // Remove any other reply area.
    source.parent().after('<div class="span12">'
                + '<div class="reply">'
                + '<div id="replystatus" class="alert" style="display:none;">&nbsp;</div>'
                + '<form class="form-horizontal well"><fieldset>'
                + '<div class="control-group">'
                + '<input type="text" placeholder="Your Name" class="input-block-level" id="nickname" name="nickname"/>'
                + '</div>'
                + '<div class="control-group">'
                + '<textarea id="replymessage" placeholder="Comment" class="replymessage input-block-level" rows="5"></textarea>'
                + '</div>'
                + '<div class="control-group">'
                + '<button class="btn btn-primary" id="replybutton" onclick="send_comment(\'' + commentid + '\');return false;">Post comment</button>'
                + '</div>'
                + '</div>'
                + '</fieldset></form></div>');
    $('input#nickname').focus(function() {
        $(this).css('color', '#000');
        if ($(this).val() == $(this).attr('title')) {
            $(this).val('');
        }
    });
    $('textarea#replymessage').focus();
}

/**
 * Send a reply in a discussion.
 * @param string parentid : the comment identifier we want to send a reply to.
 */
function send_comment(parentid) {
    // Do not send if no data.
    if ($('textarea#replymessage').val().length==0) {
        return;
    }

    showStatus('Sending comment...', spin=true);
    var cipherdata = zeroCipher(pageKey(), $('textarea#replymessage').val());
    var ciphernickname = '';
    var nick=$('input#nickname').val();
    if (nick != '') {
        ciphernickname = zeroCipher(pageKey(), nick);
    }
    var data_to_send = { data:cipherdata,
                         parentid: parentid,
                         pasteid:  pasteID(),
                         nickname: ciphernickname
                       };

    $.post(scriptLocation(), data_to_send, 'json')
        .error(function() {
            showError('Error: Comment could not be sent.');
        })
        .success(function(data) {
            if (data.status == 0) {
                showStatus('Comment posted.');
                location.reload();
            }
            else if (data.status==1) {
                showError('Error: Could not post comment: '+data.message);
            }
            else {
                showError('Error: Could not post comment.');
            }
        });
    }

/**
 *  Send a new paste to server
 */
function send_data() {
    // Do not send if no data.
    if ($('textarea#messageValue').val().length == 0) {
        return;
    }

    showStatus('Sending paste...', spin=true);

    var randomkey = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0);
    var cipherdata = zeroCipher(randomkey, $('textarea#messageValue').val());
    var data_to_send = { data:           cipherdata,
                         expire:         $('select#pasteExpiration').val(),
                         language:       $('select#language').val(),
                         opendiscussion: $('input#opendiscussion').is(':checked') ? 1 : 0
                       };

    $.post(scriptLocation(), data_to_send, 'json')
        .error(function() {
            showError('Error: Data could not be sent.');
        })
        .success(function(data) {
            if (data.status == 0) {
                stateExistingPaste();
                var url = scriptLocation() + "?" + data.id + '#' + randomkey;
                showStatus('');
                $('div#pastelink').html('Paste url: <a href="' + url + '">' + url + '</a>').show();
                setElementText($('pre#cleartext'), $('textarea#messageValue').val());
                urls2links($('pre#cleartext'));
                $('pre#cleartext').snippet($('select#language').val(), {style:"ide-codewarrior"});
                showStatus('');
            }
            else if (data.status==1) {
                showError('Error: Could not create paste - '+data.message);
            }
            else {
                showError('Error: Could not create paste.');
            }
        });
}

/**
 * Put the screen in "New paste" mode.
 */
function stateNewPaste() {
    $('button#sendbutton').show();
    $('div#expiration').show();
    $('div#remainingtime').hide();
    $('div#language').show();
    $('input#password').hide(); //$('#password').show();
    $('div#opendisc').show();
    $('button#newbutton').show();
    $('div#pastelink').hide();
    $('textarea#messageValue').text('');
    $('textarea#message').show();
    $('div#cleartext').hide();
    $('textarea#messageValue').focus();
    $('div#discussion').hide();
}

/**
 * Put the screen in "Existing paste" mode.
 */
function stateExistingPaste() {
    $('#message').hide();
    $('#toolbar').hide();
    $('pre#cleartext').show();
}

/**
 * Create a new paste.
 */
function newPaste() {
    stateNewPaste();
    showStatus('');
    $('textarea#messageValue').text('');
}

/**
 * Display an error message
 * (We use the same function for paste and reply to comments)
 */
function showError(message) {
    $('div#status').addClass('alert-error').text(message);
    $('div#replystatus').addClass('alert-error').text(message);
    $('div#status').show();
    $('div#replystatus').show();
}

/**
 * Display status
 * (We use the same function for paste and reply to comments)
 *
 * @param string message : text to display
 * @param boolean spin (optional) : tell if the "spinning" animation should be displayed.
 */
function showStatus(message, spin) {
    $('div#replystatus').removeClass('alert-error');
    $('div#replystatus').text(message);
    $('div#status').removeClass('alert-error');
    $('div#status').text(message);

    if (!message || message == '') {
        $('div#status').html('&nbsp');
        $('div#status').hide();
        $('div#replystatus').html('&nbsp');
        $('div#replystatus').hide();
        return;
    }

    $('div#status').show();

    if (spin) {
        var img = '<img src="img/busy.gif" style="width:16px;height:9px;margin:0px 4px 0px 0px;" />';
        $('div#status').prepend(img);
        $('div#replystatus').prepend(img);
    }
}

/**
 * Convert URLs to clickable links.
 * URLs to handle:
 * <code>
 *     magnet:?xt.1=urn:sha1:YNCKHTQCWBTRNJIV4WNAE52SJUQCZO5C&xt.2=urn:sha1:TXGCZQTH26NL6OUQAJJPFALHG2LTGBC7
 *     http://localhost:8800/zero/?6f09182b8ea51997#WtLEUO5Epj9UHAV9JFs+6pUQZp13TuspAUjnF+iM+dM=
 *     http://user:password@localhost:8800/zero/?6f09182b8ea51997#WtLEUO5Epj9UHAV9JFs+6pUQZp13TuspAUjnF+iM+dM=
 * </code>
 *
 * @param object element : a jQuery DOM element.
 * @FIXME: add ppa & apt links.
 */
function urls2links(element) {
    var re = /((http|https|ftp):\/\/[\w?=&.\/-;#@~%+-]+(?![\w\s?&.\/;#~%"=-]*>))/ig;
    element.html(element.html().replace(re,'<a href="$1" rel="nofollow">$1</a>'));
    var re = /((magnet):[\w?=&.\/-;#@~%+-]+)/ig;
    element.html(element.html().replace(re,'<a href="$1">$1</a>'));
}

/**
 * Return the deciphering key stored in anchor part of the URL
 */
function pageKey() {
    var key = window.location.hash.substring(1);  // Get key

    // Some stupid web 2.0 services and redirectors add data AFTER the anchor
    // (such as &utm_source=...).
    // We will strip any additional data.

    // First, strip everything after the equal sign (=) which signals end of base64 string.
    i = key.indexOf('='); if (i>-1) { key = key.substring(0,i+1); }

    // If the equal sign was not present, some parameters may remain:
    i = key.indexOf('&'); if (i>-1) { key = key.substring(0,i); }

    // Then add trailing equal sign if it's missing
    if (key.charAt(key.length-1)!=='=') key+='=';

    return key;
}

$(function() {
    $('select#pasteExpiration').change(function() {
        if ($(this).val() == 'burn') {
            $('div#opendisc').addClass('buttondisabled');
            $('input#opendiscussion').attr('disabled',true);
        }
        else {
            $('div#opendisc').removeClass('buttondisabled');
            $('input#opendiscussion').removeAttr('disabled');
        }
    });


    // Display an existing paste
    if ($('div#cipherdata').text().length > 1) {
        // Missing decryption key in URL ?
        if (window.location.hash.length == 0) {
            showError('Error: Cannot decrypt paste - Decryption key missing in URL.');
            return;
        }

        // List of messages to display
        var messages = jQuery.parseJSON($('div#cipherdata').text());

        // Show proper elements on screen.
        stateExistingPaste();

        displayMessages(pageKey(), messages);
    }
    // Display error message from php code.
    else if ($('div#errormessage').text().length>1) {
        showError('Error: ' + $('div#errormessage').text());
    }
    // Create a new paste.
    else {
        newPaste();
    }
});
