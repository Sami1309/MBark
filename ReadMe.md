# EECS 441 - MBark
EECS441 MVP for MBark - a chrome extension that helps UofM COE undergrads manage there graduation requirements.

## Cloning Repository

1. Download and setup git from https://git-scm.com/
2. Open **cmd.exe** and run: 
    ```batch 
        git clone "https://[USERNAME]:[PASSWORD]@github.com/samrg123/MBark.git" "[DESTINATION_FOLDER_NAME]" 
    ```

    > <pre>
    > Note: You may need to escape special characters in your username/password or use single quotes instead of double
    > </pre>

3. Navigate to **[DESTINATION_FOLDER_NAME]** with:
    ```batch
        cd "[DESTINATION_FOLDER_NAME]"
    ```
4. Set git name with:
    ```batch
        git config user.name "[NAME]"
    ```
4. Set git email with:
    ```batch
        git config user.email "[EMAIL_ADDRESS]"
    ```

5. [OPTIONAL] - Setup for large files Set up **git lfs** with:
    ```batch
        git lfs install
    ```


## Pushing to the Repository

1. [OPTIONAL LFS Step] Track any large files with:
     ```batch
        git lfs track "[LARGE_FILE]"
     ```
     > <pre>Note: [LARGE_FILE] can include wildcards like: "*.png"</pre>
2. Commit your changes with:
    ```batch 
        git add "[MODIFIED_FILE/DIR_1 | MODIFIED_FILE/DIR_1 | ...]"
        git commit -m "[COMMIT_MESSAGE]"
        git push
    ```
    > <pre>
    > Note: <b>git add</b> can include wildcards like: "*.png"
    >       You can also use <b>git add -u</b> to add all modified files
    >       If you want to remove a file use <b>git rm -f</b> but be careful!
    > </pre>