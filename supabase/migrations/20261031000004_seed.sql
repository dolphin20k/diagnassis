-- DIAGNASSIS seed data: curated roles, skills, weights, starter question bank, policies, settings.
-- Source: design handoff prototype data (roles/weights/trends/questions/policy text).
-- Idempotent where practical so a re-run does not duplicate rows.

insert into public.skills (name, why) values
($q$JavaScript$q$, $q$The language of every web interface. Almost every frontend and full stack interview starts here.$q$),
($q$TypeScript$q$, $q$Teams use it to catch bugs before code ships. It now appears in most new frontend listings.$q$),
($q$React$q$, $q$The most requested UI library in Indian product companies. Most frontend job posts list it by name.$q$),
($q$Next.js$q$, $q$Popular for fast, SEO-friendly React apps. Startups often expect it for production frontends.$q$),
($q$HTML & CSS$q$, $q$Every screen you build is made of it. Clean, accessible layouts are checked in take-home tasks.$q$),
($q$Tailwind CSS$q$, null),
($q$Node.js$q$, $q$Lets you write servers in JavaScript. It powers the backend of many startups and SaaS products.$q$),
($q$Express.js$q$, null),
($q$REST APIs$q$, $q$Apps talk to servers through APIs. You will fetch, send and debug API data in day-to-day work.$q$),
($q$Git$q$, $q$Every team uses it to share and review code. You will use it from your first day on the job.$q$),
($q$Python$q$, $q$Readable and widely used for scripting, data work and backends. A strong second language for any role.$q$),
($q$Java$q$, $q$Many existing Android and enterprise codebases still use it, so you will read and maintain it.$q$),
($q$C++$q$, $q$Fast and close to the hardware. Game engines and performance-critical code rely on it.$q$),
($q$C#$q$, $q$The scripting language for Unity. Every gameplay feature is written in it.$q$),
($q$Kotlin$q$, $q$Google's preferred language for Android. New Android codebases are written in it.$q$),
($q$SQL$q$, $q$Most business data lives in relational databases. Writing correct queries is tested in almost every round.$q$),
($q$MongoDB$q$, $q$A common document database for flexible data. Many MERN-stack teams expect working knowledge.$q$),
($q$PostgreSQL$q$, null),
($q$Docker$q$, $q$Packages an app so it runs the same everywhere. Teams use it for local setup and deployment.$q$),
($q$Kubernetes$q$, $q$Runs and scales containers in production. Common in DevOps and cloud job posts.$q$),
($q$AWS$q$, $q$The most used cloud platform. Many roles expect you to deploy and manage services on it.$q$),
($q$Linux$q$, $q$Most servers run Linux. You need the command line to deploy, debug and monitor services.$q$),
($q$CI/CD$q$, $q$Automates testing and releases so teams can ship safely many times a day.$q$),
($q$Terraform$q$, $q$Defines infrastructure as code so environments are repeatable and reviewable.$q$),
($q$Pandas$q$, $q$The standard Python tool for cleaning and shaping data. Analysts use it every day.$q$),
($q$NumPy$q$, null),
($q$Statistics$q$, $q$Helps you tell real patterns from noise, so your conclusions hold up when someone asks why.$q$),
($q$Excel$q$, $q$Still the shared language of business teams. Quick analysis and clear sheets are expected.$q$),
($q$Power BI$q$, $q$Turns data into dashboards managers use to decide. Demand for it is rising in analyst roles.$q$),
($q$Data Visualisation$q$, $q$A clear chart is how your analysis gets understood and acted on.$q$),
($q$Machine Learning$q$, $q$The core of the role: choosing, training and evaluating models that solve real problems.$q$),
($q$Deep Learning$q$, $q$Powers vision, speech and language systems. Needed for most modern ML projects.$q$),
($q$PyTorch$q$, $q$The framework most research and industry ML teams build models with.$q$),
($q$TensorFlow$q$, null),
($q$Spring Boot$q$, null),
($q$Android SDK$q$, $q$The building blocks of every Android app: activities, lifecycle, storage and permissions.$q$),
($q$Jetpack Compose$q$, $q$The modern way to build Android UIs. Most new screens use it.$q$),
($q$Firebase$q$, $q$Gives apps login, database and notifications quickly. Popular in startups and hackathons.$q$),
($q$Data Structures$q$, $q$Picking the right structure keeps code fast. It is tested in nearly every technical interview.$q$),
($q$System Design$q$, $q$Shows you can plan software that scales. It becomes a separate interview round for backend roles.$q$),
($q$Testing (Jest)$q$, $q$Tested code is safer to change. Interviewers look for it as a sign of professional habits.$q$),
($q$Accessibility$q$, $q$Products must work for everyone, and many companies now audit for it before release.$q$),
($q$Networking$q$, $q$Cloud systems are connected networks. You need to understand ports, DNS and routing to fix them.$q$),
($q$Unity$q$, $q$The most widely used game engine, especially for mobile and indie games.$q$),
($q$MLOps$q$, $q$Gets models out of notebooks and into production, where they create value.$q$)
on conflict (lower(btrim(name))) do nothing;

insert into public.roles (name, declining_skills, last_reviewed_at) values
($q$Frontend Developer$q$, array[$q$jQuery$q$,$q$Bootstrap 3$q$]::text[], now()),
($q$Backend Developer$q$, array[$q$PHP 5$q$,$q$SOAP services$q$]::text[], now()),
($q$Full Stack Developer$q$, array[$q$jQuery$q$,$q$AngularJS$q$]::text[], now()),
($q$Data Analyst$q$, array[$q$VBA macros$q$]::text[], now()),
($q$ML Engineer$q$, array[$q$Theano$q$]::text[], now()),
($q$DevOps Engineer$q$, array[$q$Jenkins freestyle jobs$q$]::text[], now()),
($q$Android Developer$q$, array[$q$XML-only layouts$q$]::text[], now()),
($q$Cloud Engineer$q$, array[$q$On-premise VMware$q$]::text[], now())
on conflict (lower(btrim(name))) do nothing;

insert into public.role_skills (role_id, skill_id, weight, priority, trend, trend_change)
select r.id, s.id, v.weight, v.priority::public.skill_priority, v.trend::public.skill_trend, v.trend_change
from (values
($q$Frontend Developer$q$, $q$JavaScript$q$, 18, 'high', 'stable', null),
($q$Frontend Developer$q$, $q$React$q$, 17, 'high', 'stable', null),
($q$Frontend Developer$q$, $q$TypeScript$q$, 13, 'high', 'rising', $q$+14%$q$),
($q$Frontend Developer$q$, $q$HTML & CSS$q$, 12, 'high', 'stable', null),
($q$Frontend Developer$q$, $q$REST APIs$q$, 10, 'medium', 'stable', null),
($q$Frontend Developer$q$, $q$Next.js$q$, 8, 'medium', 'rising', $q$+11%$q$),
($q$Frontend Developer$q$, $q$Testing (Jest)$q$, 8, 'medium', 'rising', $q$+5%$q$),
($q$Frontend Developer$q$, $q$Git$q$, 7, 'low', 'stable', null),
($q$Frontend Developer$q$, $q$Accessibility$q$, 7, 'low', 'rising', $q$+6%$q$),
($q$Backend Developer$q$, $q$Node.js$q$, 16, 'high', 'stable', null),
($q$Backend Developer$q$, $q$SQL$q$, 16, 'high', 'stable', null),
($q$Backend Developer$q$, $q$REST APIs$q$, 15, 'high', 'stable', null),
($q$Backend Developer$q$, $q$System Design$q$, 10, 'medium', 'rising', $q$+7%$q$),
($q$Backend Developer$q$, $q$Python$q$, 10, 'medium', 'stable', null),
($q$Backend Developer$q$, $q$Docker$q$, 10, 'medium', 'rising', $q$+9%$q$),
($q$Backend Developer$q$, $q$MongoDB$q$, 9, 'medium', 'stable', null),
($q$Backend Developer$q$, $q$Git$q$, 8, 'medium', 'stable', null),
($q$Backend Developer$q$, $q$Linux$q$, 6, 'low', 'stable', null),
($q$Full Stack Developer$q$, $q$JavaScript$q$, 16, 'high', 'stable', null),
($q$Full Stack Developer$q$, $q$React$q$, 15, 'high', 'stable', null),
($q$Full Stack Developer$q$, $q$Node.js$q$, 14, 'high', 'stable', null),
($q$Full Stack Developer$q$, $q$SQL$q$, 12, 'medium', 'stable', null),
($q$Full Stack Developer$q$, $q$REST APIs$q$, 12, 'medium', 'stable', null),
($q$Full Stack Developer$q$, $q$TypeScript$q$, 10, 'medium', 'rising', $q$+14%$q$),
($q$Full Stack Developer$q$, $q$Git$q$, 8, 'medium', 'stable', null),
($q$Full Stack Developer$q$, $q$Docker$q$, 7, 'low', 'rising', $q$+9%$q$),
($q$Full Stack Developer$q$, $q$MongoDB$q$, 6, 'low', 'stable', null),
($q$Data Analyst$q$, $q$SQL$q$, 20, 'high', 'stable', null),
($q$Data Analyst$q$, $q$Python$q$, 15, 'high', 'stable', null),
($q$Data Analyst$q$, $q$Statistics$q$, 15, 'high', 'stable', null),
($q$Data Analyst$q$, $q$Pandas$q$, 14, 'high', 'stable', null),
($q$Data Analyst$q$, $q$Excel$q$, 12, 'medium', 'stable', null),
($q$Data Analyst$q$, $q$Power BI$q$, 12, 'medium', 'rising', $q$+7%$q$),
($q$Data Analyst$q$, $q$Data Visualisation$q$, 8, 'medium', 'stable', null),
($q$Data Analyst$q$, $q$Git$q$, 4, 'low', 'stable', null),
($q$ML Engineer$q$, $q$Python$q$, 20, 'high', 'stable', null),
($q$ML Engineer$q$, $q$Machine Learning$q$, 18, 'high', 'stable', null),
($q$ML Engineer$q$, $q$Deep Learning$q$, 12, 'high', 'stable', null),
($q$ML Engineer$q$, $q$PyTorch$q$, 12, 'medium', 'rising', $q$+12%$q$),
($q$ML Engineer$q$, $q$Statistics$q$, 10, 'medium', 'stable', null),
($q$ML Engineer$q$, $q$SQL$q$, 8, 'medium', 'stable', null),
($q$ML Engineer$q$, $q$Docker$q$, 8, 'medium', 'rising', $q$+9%$q$),
($q$ML Engineer$q$, $q$Git$q$, 6, 'low', 'stable', null),
($q$ML Engineer$q$, $q$MLOps$q$, 6, 'low', 'rising', $q$+10%$q$),
($q$DevOps Engineer$q$, $q$Linux$q$, 16, 'high', 'stable', null),
($q$DevOps Engineer$q$, $q$Docker$q$, 16, 'high', 'rising', $q$+9%$q$),
($q$DevOps Engineer$q$, $q$Kubernetes$q$, 14, 'high', 'rising', $q$+8%$q$),
($q$DevOps Engineer$q$, $q$CI/CD$q$, 14, 'high', 'stable', null),
($q$DevOps Engineer$q$, $q$AWS$q$, 14, 'high', 'rising', $q$+6%$q$),
($q$DevOps Engineer$q$, $q$Git$q$, 10, 'medium', 'stable', null),
($q$DevOps Engineer$q$, $q$Python$q$, 8, 'medium', 'stable', null),
($q$DevOps Engineer$q$, $q$Terraform$q$, 8, 'medium', 'rising', $q$+9%$q$),
($q$Android Developer$q$, $q$Kotlin$q$, 22, 'high', 'stable', null),
($q$Android Developer$q$, $q$Android SDK$q$, 18, 'high', 'stable', null),
($q$Android Developer$q$, $q$Jetpack Compose$q$, 14, 'high', 'rising', $q$+15%$q$),
($q$Android Developer$q$, $q$Java$q$, 12, 'medium', 'declining', $q$-8%$q$),
($q$Android Developer$q$, $q$REST APIs$q$, 12, 'medium', 'stable', null),
($q$Android Developer$q$, $q$Git$q$, 8, 'medium', 'stable', null),
($q$Android Developer$q$, $q$SQL$q$, 7, 'low', 'stable', null),
($q$Android Developer$q$, $q$Firebase$q$, 7, 'low', 'stable', null),
($q$Cloud Engineer$q$, $q$AWS$q$, 20, 'high', 'rising', $q$+6%$q$),
($q$Cloud Engineer$q$, $q$Linux$q$, 14, 'high', 'stable', null),
($q$Cloud Engineer$q$, $q$Docker$q$, 12, 'medium', 'rising', $q$+9%$q$),
($q$Cloud Engineer$q$, $q$Kubernetes$q$, 12, 'medium', 'rising', $q$+8%$q$),
($q$Cloud Engineer$q$, $q$Terraform$q$, 12, 'medium', 'rising', $q$+9%$q$),
($q$Cloud Engineer$q$, $q$Networking$q$, 12, 'medium', 'stable', null),
($q$Cloud Engineer$q$, $q$Python$q$, 10, 'medium', 'stable', null),
($q$Cloud Engineer$q$, $q$Git$q$, 8, 'low', 'stable', null)
) as v(role_name, skill_name, weight, priority, trend, trend_change)
join public.roles r on lower(r.name) = lower(v.role_name)
join public.skills s on lower(s.name) = lower(v.skill_name)
on conflict (role_id, skill_id) do nothing;

-- 47 starter questions (source = 'seed'). Keys are stored in question_keys, never exposed to the API.
with v(skill_name, prompt, options, correct_index) as (values
($q$JavaScript$q$, $q$What does typeof null return?$q$, $q$["\"null\"","\"object\"","\"undefined\"","\"number\""]$q$::jsonb, 1),
($q$JavaScript$q$, $q$Which array method returns a new array containing only elements that pass a test?$q$, $q$["map()","forEach()","filter()","reduce()"]$q$::jsonb, 2),
($q$JavaScript$q$, $q$What does console.log(0.1 + 0.2 === 0.3) print?$q$, $q$["true","false","undefined","It throws a TypeError"]$q$::jsonb, 1),
($q$JavaScript$q$, $q$Which keyword declares a block-scoped variable that can be reassigned?$q$, $q$["var","let","const","static"]$q$::jsonb, 1),
($q$JavaScript$q$, $q$What does await do inside an async function?$q$, $q$["Blocks the main thread","Pauses that function until the promise settles","Converts a callback into a promise","Runs in a web worker"]$q$::jsonb, 1),
($q$JavaScript$q$, $q$What is a closure?$q$, $q$["A function bundled with references to its surrounding scope","A way to close a browser tab","A sealed object","A finished promise"]$q$::jsonb, 0),
($q$React$q$, $q$What causes a function component to re-render?$q$, $q$["Changing a local variable","Calling a state setter with a new value","Reading a prop","Calling console.log"]$q$::jsonb, 1),
($q$React$q$, $q$When does useEffect with an empty dependency array run?$q$, $q$["On every render","Once, after the first render","Only before unmount","Never"]$q$::jsonb, 1),
($q$React$q$, $q$Why should items in a rendered list have a key prop?$q$, $q$["To style them","To help React match items between renders","To make them focusable","To sort them"]$q$::jsonb, 1),
($q$React$q$, $q$Which hook memoises a computed value between renders?$q$, $q$["useRef","useMemo","useCallback","useId"]$q$::jsonb, 1),
($q$React$q$, $q$What does "lifting state up" mean?$q$, $q$["Moving state to the closest common parent","Storing state in localStorage","Using a global variable","Moving state into a child"]$q$::jsonb, 0),
($q$HTML & CSS$q$, $q$Which element is most appropriate for the main navigation links?$q$, $q$["<div>","<nav>","<section>","<aside>"]$q$::jsonb, 1),
($q$HTML & CSS$q$, $q$What does box-sizing: border-box change?$q$, $q$["Margins are included in the width","Padding and border are included in the width","The border is removed","Width becomes auto"]$q$::jsonb, 1),
($q$HTML & CSS$q$, $q$In Flexbox, which property aligns items on the cross axis?$q$, $q$["justify-content","align-items","flex-wrap","order"]$q$::jsonb, 1),
($q$HTML & CSS$q$, $q$Which selector has the highest specificity?$q$, $q$[".card p","#main","div p","*"]$q$::jsonb, 1),
($q$HTML & CSS$q$, $q$Which unit is relative to the root element's font size?$q$, $q$["em","rem","vh","px"]$q$::jsonb, 1),
($q$Git$q$, $q$Which command stages all changes in the current directory?$q$, $q$["git commit -a","git add .","git push","git stash"]$q$::jsonb, 1),
($q$Git$q$, $q$What does git pull do?$q$, $q$["Fetches only","Fetches and merges","Pushes and merges","Resets to the remote"]$q$::jsonb, 1),
($q$Git$q$, $q$How do you create and switch to a new branch called feature?$q$, $q$["git branch -d feature","git checkout -b feature","git merge feature","git init feature"]$q$::jsonb, 1),
($q$Git$q$, $q$What does git revert <commit> do?$q$, $q$["Deletes the commit from history","Creates a new commit that undoes it","Moves HEAD back one commit","Stashes the commit"]$q$::jsonb, 1),
($q$Git$q$, $q$Which file lists paths Git should not track?$q$, $q$[".gitconfig",".gitignore",".gitkeep","README.md"]$q$::jsonb, 1),
($q$REST APIs$q$, $q$Which HTTP method is idempotent and replaces a resource?$q$, $q$["POST","PUT","PATCH","CONNECT"]$q$::jsonb, 1),
($q$REST APIs$q$, $q$Which status code means a resource was created?$q$, $q$["200","201","204","301"]$q$::jsonb, 1),
($q$REST APIs$q$, $q$What does a 401 status mean?$q$, $q$["Not found","Not authenticated","Server error","Rate limited"]$q$::jsonb, 1),
($q$REST APIs$q$, $q$Which is the most RESTful URL for the orders of user 42?$q$, $q$["/getUserOrders?id=42","/users/42/orders","/orders/get/42","/user-orders-42"]$q$::jsonb, 1),
($q$REST APIs$q$, $q$What does "stateless" mean in REST?$q$, $q$["The server stores no data at all","Each request carries everything needed to process it","Responses are never cached","Only GET requests are allowed"]$q$::jsonb, 1),
($q$Python$q$, $q$What is len({1, 2, 2, 3})?$q$, $q$["4","3","2","It raises an error"]$q$::jsonb, 1),
($q$Python$q$, $q$Which expression builds a list of squares from 0 to 4?$q$, $q$["[x*x for x in range(5)]","(x*x for x in 5)","{x*x in range(5)}","list(x*x, 5)"]$q$::jsonb, 0),
($q$Python$q$, $q$What does a[::-1] return for a list a?$q$, $q$["The first element","A reversed copy","The last element","An error"]$q$::jsonb, 1),
($q$Python$q$, $q$Which of these types is immutable?$q$, $q$["list","dict","tuple","set"]$q$::jsonb, 2),
($q$Python$q$, $q$What does "with open(path) as f:" guarantee?$q$, $q$["Faster reads","The file is closed when the block ends","The file is created if missing","Binary mode"]$q$::jsonb, 1),
($q$SQL$q$, $q$Which clause filters groups after aggregation?$q$, $q$["WHERE","HAVING","ORDER BY","LIMIT"]$q$::jsonb, 1),
($q$SQL$q$, $q$What does a LEFT JOIN return?$q$, $q$["Only matching rows","All left rows plus matches from the right","All right rows","A cartesian product"]$q$::jsonb, 1),
($q$SQL$q$, $q$How does COUNT(column) differ from COUNT(*)?$q$, $q$["Counts distinct values","Ignores NULLs","Always faster","Counts columns"]$q$::jsonb, 1),
($q$SQL$q$, $q$Which keyword removes duplicate rows from a result?$q$, $q$["UNIQUE","DISTINCT","DIFFERENT","SINGLE"]$q$::jsonb, 1),
($q$SQL$q$, $q$Which index type suits both equality and range lookups in most databases?$q$, $q$["B-tree","Bitmap","Full-text","Hash only"]$q$::jsonb, 0),
($q$SQL$q$, $q$Which index type suits equality and range lookups?$q$, $q$["B-tree","Bitmap","Full-text","Hash only"]$q$::jsonb, 0),
($q$C++$q$, $q$What does std::vector::push_back do?$q$, $q$["Removes the last element","Appends an element","Sorts the vector","Only reserves memory"]$q$::jsonb, 1),
($q$C++$q$, $q$What does passing by reference, void f(int &x), allow?$q$, $q$["A copy is made","f can modify the caller's variable","x becomes constant","x becomes a pointer"]$q$::jsonb, 1),
($q$C++$q$, $q$Which standard container keeps its keys sorted?$q$, $q$["unordered_map","map","vector","deque"]$q$::jsonb, 1),
($q$C++$q$, $q$What is a virtual function used for?$q$, $q$["Inline expansion","Runtime polymorphism","Template specialisation","Memory allocation"]$q$::jsonb, 1),
($q$C++$q$, $q$What is the time complexity of binary search on a sorted array?$q$, $q$["O(n)","O(log n)","O(n log n)","O(1)"]$q$::jsonb, 1),
($q$Docker$q$, $q$What does a Dockerfile describe?$q$, $q$["How to build an image","A running container's logs","A Kubernetes cluster","Network routes"]$q$::jsonb, 0),
($q$Docker$q$, $q$Which command lists running containers?$q$, $q$["docker images","docker ps","docker build","docker pull"]$q$::jsonb, 1),
($q$Docker$q$, $q$What is a volume used for?$q$, $q$["Persisting data outside the container lifecycle","Increasing CPU","Exposing ports","Tagging images"]$q$::jsonb, 0),
($q$Docker$q$, $q$What does EXPOSE in a Dockerfile do?$q$, $q$["Publishes a port to the host","Documents the port the container listens on","Opens the firewall","Starts the app"]$q$::jsonb, 1),
($q$Docker$q$, $q$Why use multi-stage builds?$q$, $q$["To run several containers","To keep the final image small","To speed up the network","To share volumes"]$q$::jsonb, 1)
), ins as (
  insert into public.questions (skill_id, prompt, options, source)
  select s.id, v.prompt, v.options, 'seed'
  from v join public.skills s on lower(s.name) = lower(v.skill_name)
  on conflict (skill_id, md5(lower(btrim(prompt)))) do nothing
  returning id, skill_id, prompt
)
insert into public.question_keys (question_id, correct_index)
select ins.id, v.correct_index
from ins
join public.skills s on s.id = ins.skill_id
join v on lower(v.skill_name) = lower(s.name) and v.prompt = ins.prompt
on conflict (question_id) do nothing;

insert into public.policies (type, version, body, change_note, published_at) values
('terms', $q$2.1$q$, $q$## 1. What DIAGNASSIS is
DIAGNASSIS is a career readiness diagnostic. You choose a target job role, confirm your skills and take a short multiple-choice test. We compare your tested results with current job market requirements for that role and show you a readiness score, a skill gap view, market trends and suggested next steps. DIAGNASSIS does not list jobs, offer courses or place students.

## 2. Who can use it
The service is intended for undergraduate engineering students. You sign in with a Google account that belongs to you. You are responsible for activity on your account.

## 3. Fair use of diagnostics
Each account can run a limited number of diagnostics. The current limit is shown on your dashboard. Answer questions yourself and without outside help, so your result reflects your real skills.

## 4. How to read your result
Scores and recommendations are guidance based on your answers and on published job requirements. They are not a guarantee of selection by any employer and are not a formal certification. Requirements for roles you type in yourself are estimated automatically and may be less precise.

## 5. Learning resources
We link to free third-party videos on YouTube. We do not control that content and are not responsible for it.

## 6. Changes to these terms
When we publish a new version you will be asked to review and accept it before continuing. The version number and date at the top of this page always reflect the current terms.

## 7. Contact
Questions about these terms can be sent through the Feedback page inside the app.$q$, 'Initial published version.', now()),
('privacy', $q$1.4$q$, $q$## What we collect
From Google: your name, email address and profile photo. From you: college, branch, year of study, skills, target role, test answers, ratings and feedback.

## Why we collect it
To run diagnostics, generate your results and PDF report, keep your attempt history, and improve question quality and role requirements. Aggregated, anonymised figures help us understand which skill gaps are most common.

## What we do not do
We do not sell your data, share it with recruiters or show you advertising. We do not send marketing email. Notifications appear only inside the app.

## Who can see your data
You, and the single platform administrator who maintains DIAGNASSIS. The administrator can see your profile and results in order to support you and review account deletion requests.

## Keeping and deleting data
Your data is kept while your account is active. You can request deletion from Settings. Once approved, your profile, attempts and reports are permanently removed within 30 days.

## What changed in version 1.4
We clarified that only the platform administrator can view individual results, and added the 30-day deletion window.$q$, 'Initial published version.', now())
on conflict (type, version) do nothing;

insert into public.app_settings (key, value) values ('attempt_limit', '5'::jsonb)
on conflict (key) do nothing;
