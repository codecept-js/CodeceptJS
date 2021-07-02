<html>
<body>
<form action="/form/complex" method="POST">
    <label for="name">Name</label>
    <input type="text" id="name" name="name" value="OLD_VALUE" />
    <input type="text" id="email" name="email" style="display:none;"/>
    <input type="submit" value="Submit" />
</form>
<form style="width: 100px; height: 40px; visibility:hidden; background: red" action="/form/simple" method="POST">
    <input type="text" id="noid" name="noname" value="RANDOM_VALUE" />
</form>
</body>
</html>
