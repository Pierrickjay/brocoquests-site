// Mini-quiz des fiches de révision BrocoQuests (aucune dépendance)
(function () {
  document.querySelectorAll('.quiz-box[data-quiz]').forEach(function (box) {
    var questions = JSON.parse(box.getAttribute('data-quiz'));
    var camp = box.getAttribute('data-camp') || 'fiche';
    var answered = 0, score = 0;
    box.innerHTML = '';

    var list = document.createElement('ol');
    list.className = 'quiz-list';
    questions.forEach(function (q, i) {
      var li = document.createElement('li');
      li.className = 'quiz-q';
      var phrase = document.createElement('p');
      phrase.className = 'quiz-phrase';
      phrase.innerHTML = q.p.replace('___', '<span class="blank">…</span>');
      var opts = document.createElement('div');
      opts.className = 'quiz-opts';
      opts.setAttribute('role', 'group');
      opts.setAttribute('aria-label', 'Question ' + (i + 1));
      var expl = document.createElement('p');
      expl.className = 'quiz-expl';
      expl.hidden = true;

      q.o.forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt;
        b.addEventListener('click', function () {
          if (li.classList.contains('done')) return;
          li.classList.add('done');
          var ok = opt === q.r;
          if (ok) score++;
          answered++;
          li.classList.add(ok ? 'ok' : 'ko');
          opts.querySelectorAll('button').forEach(function (x) {
            x.disabled = true;
            if (x.textContent === q.r) x.classList.add('is-right');
            else if (x === b) x.classList.add('is-wrong');
          });
          phrase.querySelector('.blank').textContent = q.r;
          expl.innerHTML = '<strong>' + (ok ? 'Bien joué !' : 'Pas tout à fait.') + '</strong> ' + q.e;
          expl.hidden = false;
          if (answered === questions.length) showResult();
        });
        opts.appendChild(b);
      });
      li.appendChild(phrase);
      li.appendChild(opts);
      li.appendChild(expl);
      list.appendChild(li);
    });
    box.appendChild(list);

    function showResult() {
      var res = document.createElement('div');
      res.className = 'quiz-result';
      var perfect = score === questions.length;
      res.innerHTML = '<p class="quiz-score">' + score + ' / ' + questions.length + '</p>' +
        '<p>' + (perfect ? 'Sans faute ! Reste à ne pas l\'oublier dans 3 semaines, et pour ça il y a une solution.'
          : 'Encore quelques hésitations. Dans l\'app, cette règle revient jusqu\'à ce qu\'elle devienne naturelle pour toi.') + '</p>' +
        '<a class="btn" href="/app/?src=site&camp=' + encodeURIComponent(camp + '-quiz') + '">Continuer dans l\'app →</a>';
      box.appendChild(res);
    }
  });
})();
