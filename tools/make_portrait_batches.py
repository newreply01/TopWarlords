import json
u = json.load(open('D:/TopWarlords/tools/all_units.json', encoding='utf-8'))
done = {'GUANYU', 'SHINGEN', 'YISUNSIN', 'ZHUGELIANG', 'HUO'}
cat = {'air': 'cavalry', 'armor': 'heavy infantry', 'air_defense': 'archer/crossbow/gunner',
       'naval': 'vanguard assault/navy', 'support': 'strategist/support'}
rows = [f"{x['id']}|{x['name']}|{x['origin']}|{cat[x['cat']]}|{x['weapon']}" for x in u if x['id'] not in done]
print(len(rows))
N = 4
for i in range(N):
    open(f'D:/TopWarlords/cache/portrait_batch_{i}.txt', 'w', encoding='utf-8').write('\n'.join(rows[i::N]))

