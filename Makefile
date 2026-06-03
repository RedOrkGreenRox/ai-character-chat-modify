.PHONY: regression verify build indexes worker-check package-backend check-in-docker

regression:
	cd ai-character-chat-modify && python tools/regression.py

verify:
	cd ai-character-chat-modify && python tools/verify_exact_components.py

build:
	cd ai-character-chat-modify && python tools/assemble_modified.py

indexes:
	cd ai-character-chat-modify && python tools/build_extension_indexes.py

worker-check:
	node --check workshop-backend/src/worker.js
	node --check fixed-worker.js
	cd workshop-backend && npm test

package-backend:
	rm -f workshop-backend.zip
	zip -qr workshop-backend.zip workshop-backend

check-in-docker:
	bash scripts/check-in-docker.sh
