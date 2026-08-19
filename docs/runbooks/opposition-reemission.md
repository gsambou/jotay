# Runbook — Support perdu / volé (opposition et réémission)

1. Identifier le support (numéro de téléphone associé, ou UID si connu).
2. Mettre en opposition → entrée en blocklist (propagée aux terminaux à la prochaine sync ;
   un terminal offline refusera le support dès réception du delta).
3. Réémettre un nouveau support crédité du **solde serveur** du support bloqué (jamais moins ;
   on ne rembourse jamais un solde qu'on ne peut pas justifier — échec honnête).
4. Consigner l'action au journal d'audit (acteur, cible, motif).
