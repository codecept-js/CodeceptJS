<!DOCTYPE HTML>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
</head>
<style>
    .span {
        height: 15px; 
    }
</style>
<body>

<h1>Information</h1>

<p>Lots of valuable data here

    <a href="/" id="back" aria-label="index via aria-label"><img src="blank.gif" alt="Back"/></a>
    <a href="/" title="index via title"><img src="blank.gif" alt="Back"/></a>
    <a href="/" aria-labelledby="label-span"><img src="blank.gif" alt="Back"/></a>
    <span id="label-span">index via labelledby</span>
</p>

<div class="notice"><?php if (isset($notice)) echo $notice; ?></div>

<h3>Don't do that at home!</h3>

<p>Is that interesting?</p>

<form action="/" method="post">
    <input type="checkbox" name="interesting" value="1" checked="checked"/>
    <input type="text" name="rus" value="Верно"/>
    <input type="submit"/>
</form>

<p>Текст на русском</p>
<a href="/">Ссылочка</a>

<a href="/login" class="sign">Sign in!</a>

<div>Kill & Destroy</div>

<div style="display: none" class="hidden">
    Invisible text
</div>

<div id="grab-multiple">
    <a id="first-link">First</a>
    <a id="second-link">Second</a>
    <a id="third-link">Third</a>
</div>

<div id="new-tab">
<a href="/login" target="_blank">New tab</a>
</div>

<div id="grab-css">
   <span class="span" style="height:12px">Fisrt <span>
   <span class="span">Second <span>
</div>
<div class="issue2928" style="width: 100px; height: 40px; visibility:hidden; background: red">visibility:hidden</div>
<div class="issue2928" style="width: 100px; height: 40px; background: green">no visibility hidden</div>
</body>
</html>
