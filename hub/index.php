<!DOCTYPE html>
<html>
	<head>
		<title>About us</title>
		<meta charset="UTF-8">
		<link rel="stylesheet" type="text/css" href="../CSS/page.css">
		<meta name="viewport" content="width=device-width, initial-scale=1">
	</head>
	<body>
		<header>
			<div>
				<h1>About us</h1>
				<?php require("navbar"); ?>
			</div>
		</header>
		<main>
			<p>
				Back in April 2015 openings.moe was a little hobby project made in about 10-15 minutes, and look at where we are today. Hundreds of videos and an entire server network to serve all of our visitors. <br />
				<span style="white-space: nowrap;">- <a href="https://twitter.com/QuadPiece/">Quad</a> (Creator)</span>
			</p>
			<p>If you want to chat, come join us in our <a href="chat.php">IRC channel</a>.</p>

			<h1>Notable people</h1>
			<p>These guys are important. Everything from donators to testers and contributors. I pay money to some of them, some give money or services to me. Everything is here.</p>

			<h2>"Staff"</h2>
			<ul>
				<li><a href="https://twitter.com/dev_loic">pluesch</a> - Massive donator and supporter, pretty much a co-leader at this point</li>
				<li>Yay295 - Encoding <s>slave</s> and code cleaner</li>
				<li><a href="https://twitter.com/immanenz">immanenz</a> - Pretty much <a href="http://i.imgur.com/oRuwYya.png">this</a></li>
				<li>Tracreed - Developer and encoder</li>
			</ul>

			<h2>General contributors</h2>
			<ul>
				<li><a href="https://twitter.com/UwyBBQ">Uwy</a> - Huge donator and supporter</li>
			</ul>

			<h2>Volunteer encoders</h2>
			<ul>
				<li><a href="https://twitter.com/_tyge">Howl</a></li>
				<li><a href="https://twitter.com/immanenz">immanenz</a></li>
				<li><a href="https://twitter.com/lazzorx">lazzorx</a></li>
				<li>Maitom</li>
				<li>NiseVoid</li>
				<li>outrunton</li>
				<li><a href="https://twitter.com/dev_loic">pluesch</a></li>
				<li>qwertx</li>
				<li>SmokedCheese</li>
				<li>theholyduck</li>
				<li>Tracreed</li>
				<li>Yay295</li>
			</ul>

			<h2>Companies</h2>
			<ul>
				<li><a href="https://rage4.com/">Rage4</a> - GeoDNS service that enables me to run servers all around the globe</li>
				<li><a href="https://www.digitalocean.com/">DigitalOcean</a> - Powers our SSD servers</li>
				<li><a href="https://scaleway.com/">Scaleway</a> - Powers our dedicated EU2 server</li>
				<li><a href="https://vultr.com/">Vultr</a> - Powers Neptune (The main server)</li>
			</ul>

			<h2>Notable mentions</h2>
			<ul>
				<li><a href="https://twitter.com/saucenao">Xamayon</a> - He runs <a href="http://saucenao.com/">SauceNAO</a></li>
			</ul>

			<h2>And of course, all of our <a href="https://github.com/AniDevTwitter/animeopenings/graphs/contributors">GitHub contributors</a> &lt;3</h2>
		</main>

		<?php
		@include_once("../backend/includes/botnet.html");
		?>
	</body>
</html>
