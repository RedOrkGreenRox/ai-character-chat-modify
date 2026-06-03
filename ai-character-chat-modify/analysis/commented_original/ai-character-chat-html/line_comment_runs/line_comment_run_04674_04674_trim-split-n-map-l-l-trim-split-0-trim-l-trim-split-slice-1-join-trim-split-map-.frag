//         \`.trim().split("\\n").map(l => [l.trim().split(":")[0].trim(), l.trim().split(":").slice(1).join(":").trim().split("|").map(url => url.trim())]).map(a => ({label:a[0], url:a[1]}));
