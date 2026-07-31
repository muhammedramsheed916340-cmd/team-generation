#!/bin/bash
# Self-contained verification script
cd /home/z/my-project

echo "===== STARTING SERVICES ====="
pkill -f "next dev" 2>/dev/null || true
pkill -f "jobs/index" 2>/dev/null || true
sleep 1
setsid /home/z/my-project/start-next.sh > /tmp/dev-next.log 2>&1 &
setsid /home/z/my-project/start-jobs.sh > /tmp/dev-jobs.log 2>&1 &
sleep 7

echo "===== HEALTH ====="
curl -s http://localhost:3000/api/health | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(f'status:{d[\"status\"]} uptime:{d[\"uptime\"]:.0f}s')"

echo "===== RE-SEED ====="
curl -s -X POST "http://localhost:3000/api/seed?reset=true" | python3 -c "import sys,json;print('seeded:',json.load(sys.stdin)['data'])"

echo "===== LOGIN ====="
LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"demo@teamgen.in","password":"demo123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
echo "token: ${TOKEN:0:20}..."

echo "===== MATCHES ====="
MATCHES=$(curl -s http://localhost:3000/api/matches)
MATCH_ID=$(echo "$MATCHES" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['matches'][0]['id'])")
echo "match_id: $MATCH_ID"
echo "$MATCHES" | python3 -c "
import sys,json
for m in json.load(sys.stdin)['data']['matches'][:3]:
    print(f'  {m[\"shortName\"]} ({m[\"status\"]}) XI:{m[\"playingXINamed\"]} toss:{m.get(\"tossWinner\",\"-\")}')
"

echo "===== PLAYERS ====="
curl -s "http://localhost:3000/api/matches/$MATCH_ID/players" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['players']
print(f'  total players: {len(d)}')
roles={}
for p in d:
    roles[p['role']]=roles.get(p['role'],0)+1
print(f'  by role: {roles}')
avg_credit=sum(p['credit'] for p in d)/len(d)
print(f'  avg credit: {avg_credit:.1f}')
"

echo "===== GENERATE GL x5 ====="
GEN=$(curl -s -X POST "http://localhost:3000/api/matches/$MATCH_ID/generate" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"strategy":"GL","count":5}')
echo "$GEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('success'):
    print('  ERROR:',d.get('error'),d.get('code'))
else:
    teams=d['data']['teams']
    print(f'  generated: {len(teams)} teams')
    for t in teams[:3]:
        cap=[p['name'] for p in t['players'] if p.get('isCaptain')][0]
        vc=[p['name'] for p in t['players'] if p.get('isViceCaptain')][0]
        print(f'  - credit:{t[\"totalCredit\"]} uniq:{t[\"uniquenessScore\"]}% risk:{t[\"riskLevel\"]} combo:{t[\"combinationKey\"]}')
        print(f'    C:{cap} VC:{vc} players:{len(t[\"players\"])}')
"

echo "===== GENERATE SL x3 ====="
curl -s -X POST "http://localhost:3000/api/matches/$MATCH_ID/generate" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"strategy":"SL","count":3}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
teams=d.get('data',{}).get('teams',[])
print(f'  generated: {len(teams)} SL teams')
for t in teams[:2]:
    print(f'  - credit:{t[\"totalCredit\"]} uniq:{t[\"uniquenessScore\"]}% risk:{t[\"riskLevel\"]}')
"

echo "===== GENERATE H2H x2 ====="
curl -s -X POST "http://localhost:3000/api/matches/$MATCH_ID/generate" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"strategy":"H2H","count":2}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
teams=d.get('data',{}).get('teams',[])
print(f'  generated: {len(teams)} H2H teams')
for t in teams[:2]:
    print(f'  - credit:{t[\"totalCredit\"]} uniq:{t[\"uniquenessScore\"]}% risk:{t[\"riskLevel\"]}')
"

echo "===== FANTASY TRANSFER (OTP + Bulk) ====="
OTP=$(curl -s -X POST http://localhost:3000/api/fantasy/login -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"platform":"DREAM11","mobile":"9876543210"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['otp'])")
echo "  otp: $OTP"
ACC=$(curl -s -X POST http://localhost:3000/api/fantasy/verify -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"platform\":\"DREAM11\",\"mobile\":\"9876543210\",\"otp\":\"$OTP\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['account']['id'])")
echo "  account: $ACC"

echo "  remaining transfers:"
curl -s -X POST http://localhost:3000/api/fantasy/remaining-transfer -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"accountId\":\"$ACC\"}" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(f'    remaining: {d[\"remaining\"]}/{d[\"dailyLimit\"]}')"

# Build template from generated team
TEMPLATE=$(echo "$GEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
t=d['data']['teams'][0]
print(json.dumps({'players':[{'externalId':p['id'],'name':p['name'],'role':p['role']} for p in t['players']],'captainExternalId':[p for p in t['players'] if p.get('isCaptain')][0]['id'],'viceCaptainExternalId':[p for p in t['players'] if p.get('isViceCaptain')][0]['id'],'captainName':[p for p in t['players'] if p.get('isCaptain')][0]['name'],'viceCaptainName':[p for p in t['players'] if p.get('isViceCaptain')][0]['name']}))
")
echo "  template built: ${TEMPLATE:0:60}..."

QUEUE=$(curl -s -X POST http://localhost:3000/api/fantasy/bulk-transfer -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"accountId\":\"$ACC\",\"matchName\":\"SRH vs MI\",\"mode\":\"CREATE\",\"totalTeams\":10,\"concurrency\":5,\"template\":$TEMPLATE}" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['queueId'])")
echo "  queue: $QUEUE"

# Process
curl -s -X POST http://localhost:3000/api/fantasy/queue -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"queueId\":\"$QUEUE\"}" > /dev/null
sleep 5

echo "  transfer status:"
curl -s "http://localhost:3000/api/fantasy/transfer-status/$QUEUE" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
q=d['queue']
print(f'    status:{q[\"status\"]} progress:{d[\"progress\"]}% success:{q[\"successCount\"]} failed:{q[\"failedCount\"]} total:{q[\"totalTeams\"]}')
"

echo "===== FINAL METRICS ====="
curl -s http://localhost:3000/api/metrics | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
c=d['counts']
print(f'  users:{c[\"totalUsers\"]} matches:{c[\"totalMatches\"]} teams:{c[\"totalTeams\"]} transfers:{c[\"totalTransfers\"]} accounts:{c[\"totalAccounts\"]}')
print(f'  cache hit rate: {d[\"cache\"][\"hitRate\"]:.1f}%')
print(f'  transfer stats: {d.get(\"transferStats\",{})}')
"

echo "===== BROWSER CHECK ====="
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 2
agent-browser snapshot -i 2>&1 | grep "button\|textbox" | head -4
agent-browser click @e6 2>&1 | tail -1
sleep 3
echo "  tabs:"
agent-browser snapshot -i 2>&1 | grep "tab " | head -9
echo "  errors:"
agent-browser errors 2>&1 | tail -3

echo ""
echo "===== ALL VERIFICATION COMPLETE ====="
