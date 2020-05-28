# EECS 441 - MBark
EECS441 MVP for MBark - a chrome extension that helps UofM COE undergrads manage there graduation requirements.

## Cloning Repository

1. Download and setup git from https://git-scm.com/
2. Open **cmd.exe** and run: 
    ```batch 
        git clone "https://[USERNAME]:[PASSWORD]@github.com/samrg123/MBark.git" "[DESTINATION_FOLDER_NAME]" 
    ```
    > <pre>
    > Note: You may need to escape special characters in your <b>[USERNAME]</b> and <b>[PASSWORD]</b> or use single quotes instead of double quotes
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
    > <pre>
    > Note: <b>[LARGE_FILE]</b> can include wildcards like: "*.png"
    > </pre>     
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


## Installing developer extension

1. Open **chrome** and Navigate to the [extension page](chrome://extensions/)
    ![](images/ReadmeImages/InstallExtension/1.png) 

2. Enable Extension Developer Mode
    ![](images/ReadmeImages/InstallExtension/2.png)

3. Click ***"Load Unpacked"***
    ![](images/ReadmeImages/InstallExtension/3.png)   

4. Select the MBarkExtension Folder
    ![](images/ReadmeImages/InstallExtension/4.png)

5. You should now have the MBark extension Installed! 
    ![](images/ReadmeImages/InstallExtension/5.png)    
    > <pre>
    > Note: You'll get an annoying <i><b>"Disable developer mode extensions"</b></i> warning every time you start chrome
    >       You cannot disable this (there used to be an old way via group policy, but google removed it because of malware concerns)
    >       If its really bothering you can install <a href='https://www.google.com/chrome/canary/'>Chrome Canary</a>
    > </pre>
