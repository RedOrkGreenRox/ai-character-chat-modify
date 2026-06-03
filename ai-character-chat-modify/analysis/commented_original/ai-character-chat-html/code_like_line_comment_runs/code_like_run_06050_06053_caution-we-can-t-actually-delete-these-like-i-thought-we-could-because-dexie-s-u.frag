    // CAUTION: we can't actually delete these like I thought we could, because dexie's `update` function is by default a "$set", so if it's missing, then it doesn't overwrite the existing value
    // if(!result.metaTitle) delete result.metaTitle;
    // if(!result.metaDescription) delete result.metaDescription;
    // if(!result.metaImage) delete result.metaImage;
